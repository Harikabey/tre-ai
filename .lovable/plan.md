## Hedef
Kullanıcı uygulamayı açmadan, bildirimin içindeki "Cevapla" kutusuna yazarak Tre ile konuşabilsin. Cevap yine bildirim olarak gelsin.

## Akış
```
[Tre push gönderir] → [Bildirim cihazda görünür]
                          ↓ kullanıcı 'Cevapla' kutusuna yazar (Android)
                          ↓ veya tıklar (iOS — uygulama açılır)
[Service Worker reply'i yakalar] → [reply-to-tre edge function]
                                        ↓ chat fonksiyonunu çağırır
                                        ↓ AI cevabını üretir
                                        ↓ DB'ye mesajı kaydeder
[send-push edge function] → [Yeni bildirim cihaza düşer] ⟲
```

## Yapılacaklar

**1. PWA altyapısı**
- `vite-plugin-pwa` kurulumu (devOptions.enabled=false, iframe/preview guard).
- `public/manifest.json` + `public/icon-192.png`, `icon-512.png`.
- `public/sw-push.js` — özel service worker (vite-plugin-pwa'nın `injectManifest` modu ile, çünkü Workbox SW'sine push handler ekleyeceğiz).
- `src/main.tsx`: preview/iframe değilse SW kaydı.
- Kullanıcıya UYARI: PWA ve push **yalnızca yayınlanmış sürümde** (tre-ai.lovable.app) çalışır, Lovable önizlemesinde çalışmaz. iOS'ta bildirime tıklayınca uygulama açılır (inline yazma yok); Android Chrome'da bildirimden yazılabilir.

**2. VAPID anahtarları**
- `web-push` (Deno-uyumlu sürümü) ile public/private key çifti üretilecek.
- Public key client'a expose edilir (publishable), private key secret olarak eklenir.
- Yeni secret'lar: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:...).

**3. Veritabanı**
Yeni tablo: `push_subscriptions`
- `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `is_active`
- RLS: kullanıcı kendi aboneliklerini CRUD edebilir; service_role hepsini okur.

**4. Edge Functions**
- `register-push-subscription` — client subscribe olunca abonelik kaydeder.
- `send-push` — internal helper (chat fn tarafından çağrılır), bir kullanıcıya bildirim gönderir.
- `reply-to-tre` — service worker'dan gelen reply'i alır, ilgili conversation'a mesaj olarak yazar, chat fonksiyonunu çağırır, cevabı DB'ye kaydeder ve `send-push` ile geri yollar.

**5. Service Worker (`sw-push.js`)**
- `push` event: `event.data.json()` → `showNotification(title, { body, tag, data: {conversationId}, actions: [{action:'reply', type:'text', title:'Cevap yaz', placeholder:'Tre'ye yaz...'}] })`.
- `notificationclick` event: action `reply` ise `event.reply` veya `event.notification.data.replyText` ile `reply-to-tre` fetch et (JWT'yi IndexedDB'den çek). Aksi halde `clients.openWindow('/')`.

**6. Client tarafı**
- Yeni hook `src/hooks/usePushNotifications.ts`: permission iste, subscribe et, JWT'yi IndexedDB'e kaydet (SW'nin erişebilmesi için).
- Settings sayfasında yeni bölüm: "Bildirim ile sohbet" toggle + "Test bildirimi gönder" butonu.
- iOS uyarısı: "iOS'ta bildirim önce ana ekrana yüklenmiş PWA gerektirir ve cevap kutusu desteklemez."

**7. Tetikleme**
İlk sürümde "Test bildirimi" butonu ve manuel deneme. (İleride: kullanıcı sekmeyi kapatınca AI mesajı geldiğinde otomatik push — bu ayrı bir adım.)

## Teknik notlar
- `web-push` Deno'da çalışmaz; `npm:web-push` import edip ESM uyumunu test edeceğim. Alternatif: tamamen Deno-native VAPID + raw fetch (jose ile JWT imzala). İlk denemede `npm:web-push@3` kullanacağım, çalışmazsa native fallback yazacağım.
- `sw-push.js` build'e dahil olmalı — `VitePWA({ strategies: 'injectManifest', srcDir: 'public', filename: 'sw-push.js' })`.
- SW'de Supabase JWT gerekli (reply'i kullanıcı adına yazmak için). JWT'yi `idb-keyval` ile IndexedDB'ye yazıp SW'den okuyacağız.

## Onay sonrası ilk adım
Önce DB migration + VAPID secrets isteme adımıyla başlayacağım. Secrets eklenmeden edge function'lar çalışmaz.