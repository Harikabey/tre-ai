# Plan: Tre'nin Yetenek Farkındalığı + Sözleşme Güncellemesi

## 1. Tre'nin tüm yeteneklerini bilmesi

`supabase/functions/chat/index.ts` içindeki sistem prompt'una **"Yetenekler Kataloğu"** bloğu ekle. Tre, kendisine "neler yapabilirsin?" diye sorulduğunda ya da uygun bağlamda özelliklerini net biçimde tanıtabilecek.

Kataloğa dahil edilecekler (koddaki mevcut özelliklerden derlenmiştir):
- Sohbet: 6 kişilik (Arkadaş, Profesyonel, Eğlenceli, Bilge, Yaratıcı, Ayna)
- Düşünme modları: Hızlı / Derin (Gemini 2.5 Pro)
- Görsel üretme, GIF üretme, görsel analiz, canlı kamera analizi, ekran paylaşımı analizi
- Belge okuma (PDF/70+ format), web arama + kaynak gösterme, çeviri (114 dil)
- Sesli sohbet (STT/TTS), fullscreen /voice-chat, wake word "Hey Tre"
- Hatırlatıcılar (bildirim ile), push bildirim üzerinden yanıtlama
- Google (Gmail/Drive) bağlantısı, kullanıcı hafızası, duygu analizi ve iyileştirme modu
- Dosya üretme (APK, ISO, PPTX, ses), **sohbeti PDF olarak dışa aktarma**
- Erişilebilirlik ayarları, tema, çoklu dil UI

Kurallar:
- Katalog Türkçe, kısa maddeler; her özellik tek satır.
- "Neler yapabilirsin?" sorusunda özet + kategorize liste sun; başka sorularda gereksiz reklam yapma.
- Kullanıcı bir işi isteyince önce ilgili yeteneğin nasıl tetikleneceğini kısaca söyle (ör. "Ayarlar > Bildirimler'i aç").

## 2. Kullanım Sözleşmesi güncellemesi

`src/components/TermsOfServiceDialog.tsx`:
- "Son güncelleme" tarihini **7 Temmuz 2026** yap.
- **Madde 2 (Hizmet Tanımı)** metnini genişlet: yukarıdaki tüm yetenekleri özetleyen bir cümle listesi.
- Yeni maddeler ekle:
  - **17. Bildirimler ve Hatırlatıcılar** — push izni, hatırlatıcı kurma, cihaz aboneliğinin iptali.
  - **18. Sesli Etkileşim ve Uyandırma Sözcüğü** — mikrofon izni, "Hey Tre" wake word yalnızca kullanıcı ayardan etkinleştirdiğinde çalışır, ses lokal işlenir.
  - **19. Canlı Kamera ve Ekran Paylaşımı** — yalnızca kullanıcı başlatınca, akış kaydedilmez, sadece analiz için kare işlenir.
  - **20. Dosya Üretimi ve Dışa Aktarma** — üretilen APK/ISO/PPTX/PDF içeriğinin sorumluluğu kullanıcıda; PDF dışa aktarımı istemcide oluşturulur.
- Mevcut madde numaralarını koru; yeni maddeler sona eklenir.

## Teknik Notlar
- Sadece iki dosya değişecek: `supabase/functions/chat/index.ts` (system prompt katalog bloğu), `src/components/TermsOfServiceDialog.tsx` (metin).
- Chat fonksiyonundaki mevcut kişilik/tarih enjeksiyon akışı korunur; katalog ondan önce sabit blok olarak eklenir.
- Sözleşme UI/tasarımı aynı kalır, yalnızca içerik güncellenir.
