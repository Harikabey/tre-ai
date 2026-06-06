## Plan: Logoyu her yerde değiştir

Yüklediğin minimalist gümüş/krom logo görselini uygulamadaki tüm logo/ikon noktalarında kullanacağım.

### Yapılacaklar

1. **Yeni logoyu projeye al**
   - `user-uploads://...` görselini `src/assets/ai-logo.jpg` olarak (mevcut dosyanın yerine) kaydet. Böylece şu dosyalar otomatik yeni logoyu kullanır:
     - `src/components/ChatHeader.tsx`
     - `src/components/EmptyState.tsx`
     - `src/components/VoicePulseAnimation.tsx`
     - `src/pages/VoiceChat.tsx`

2. **PWA ikonları ve favicon**
   - Görseli 512x512 ve 192x192 PNG'ye çevirip şunları değiştir:
     - `public/icon-512.png`
     - `public/icon-192.png`
     - `public/favicon.ico` (yeni logodan üretilmiş .ico)
   - `public/manifest.webmanifest` zaten bu dosyaları referansladığı için ek değişiklik gerekmiyor.

3. **index.html**
   - `<link rel="icon">`, `apple-touch-icon` ve varsa `og:image` / `twitter:image` etiketlerinin yeni logoyu (favicon + icon-512) gösterdiğinden emin ol.

### Notlar
- Görsel yatay (geniş) ve şeffaf değil; PWA ikonu kare olmak zorunda, bu yüzden logoyu beyaz/şeffaf kare zemin üzerine ortalayıp 512x512 üretilecek. Sohbet içindeki yuvarlak avatarlarda da ortalanmış şekilde görünecek.
- `service worker` (sw.js) içindeki ikon referansları aynı `icon-192.png` dosyasını kullandığından bildirim ikonu da otomatik güncellenir.
