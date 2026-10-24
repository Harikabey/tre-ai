# Tre — Lovable Bağımlılık Raporu ve Çözüm Planı

## 1. Rapor: Bulunan bağımlılıklar

### A) Yapay zekâ — Lovable AI Gateway (en kritik)
11 sunucu servisinde `LOVABLE_API_KEY` ve `ai.gateway.lovable.dev` hâlâ yedek olarak duruyor:
chat, web-search, translate-message, analyze-image, analyze-mood, read-document, reply-to-tre, generate-pptx, generate-pwa-site, generate-gif, create-reminder.
- Risk: Kredi bitince 402 hatası; ücretli kullanım oluşabilir.
- create-reminder tamamen bu geçide bağımlı (ücretsiz değil).

### B) Google ile giriş — `@lovable.dev/cloud-auth-js`
Giriş sayfası ve Ayarlar (Google hesabı bağlama) Lovable'ın giriş katmanını kullanıyor.
- Risk: Lovable dışına taşınırsa Google girişi çalışmaz.

### C) Altyapı — Lovable Cloud
Veritabanı, giriş, dosya depolama (avatars, chat-attachments), sunucu servisleri Lovable Cloud üzerinde.
- Risk: Kredi bitince proje duraklatılır. Taşınması en zor kısım.

### D) Geliştirme aracı — `lovable-tagger`
Sadece geliştirme sırasında çalışır, yayındaki uygulamayı etkilemez.

### E) Adres ve metinler
- `tre-ai.lovable.app` adresi: sitemap.xml, robots.txt, llms.txt, Türkçe çeviri metni.
- index.css'te Lovable rozetini gizleyen kural.

## 2. Çözüm önerileri (öncelik sırasıyla)

1. **AI yedeklerini kaldır (önerilen, hemen):** Tüm servislerde Lovable geçidi yedeğini sil; zincir Groq → OpenRouter ücretsiz. create-reminder'ı da bu zincire bağla. Sonuç: AI tarafında sıfır Lovable bağımlılığı, sıfır ücretli çağrı.
2. **Ortak AI yardımcısı:** Groq + OpenRouter çağrısını tek ortak dosyada topla; tüm servisler onu kullansın (bakım kolaylığı).
3. **Google girişi:** Şimdilik bırak (Lovable Cloud ile en sorunsuz yol). Taşınma gerekirse kendi Google OAuth kimlik bilgilerinle doğrudan giriş akışına geçilir.
4. **Alan adı:** Kendi alan adını bağlarsan sitemap/robots/llms.txt adreslerini güncelleriz.
5. **Rozet:** CSS ile gizlemek yerine proje ayarlarındaki "Hide Lovable Badge" seçeneği kullanılmalı.
6. **lovable-tagger:** Dokunmaya gerek yok.

## 3. Uygulama adımları (onaylanırsa)
- Adım 1 ve 2'yi uygula, tüm etkilenen servisleri yeniden yayınla.
- Sohbet, çeviri, web arama ve hatırlatıcıyı canlı test et.

## Teknik detaylar
- `_shared/freeAi.ts` içine `callFreeAI(body, kind)` eklenir: Groq (metin) → OpenRouter `withFreeModel` zinciri; 15 sn zaman aşımı.
- Her servisten `LOVABLE_API_KEY` okuması ve gateway fetch blokları silinir.
- generate-gif: ücretsiz görsel modeli olmadığı için Lovable yedeği kalkınca "ücretsiz modda kullanılamıyor" mesajı döner.
