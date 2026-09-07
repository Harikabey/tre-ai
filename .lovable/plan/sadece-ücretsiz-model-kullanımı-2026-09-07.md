# Sadece Ücretsiz Model Kullanımı

Amaç: Tre'nin tüm yapay zekâ çağrıları ücretsiz sürümlerle çalışsın, ücretli kullanım kazara devreye girmesin.

## Şu anki durum

- 11 serviste OpenRouter çağrıları zaten modelin ":free" (ücretsiz) sürümünü kullanıyor: sohbet, web arama, belge okuma, görsel analizi, ruh hali analizi, görsel üretimi, GIF, PWA site, sunum, çeviri, bildirimden yanıt.
- Ancak ücretsiz çağrı başarısız olursa (hata veya limit), servisler otomatik olarak ücretli yedek sağlayıcıya düşüyor. Yani ücretsiz istemenize rağmen bazı durumlarda ücretli kullanım oluşabiliyor.

## Yapılacaklar

1. Ücretsiz-öncelik kuralını tüm servislerde tek tip hale getirmek: her yapay zekâ çağrısı önce ücretsiz sürümü dener.
2. Ücretli yedeğe otomatik geçişi kapatmak. Ücretsiz sürüm yanıt vermezse kullanıcıya anlaşılır bir mesaj gösterilir ("Ücretsiz model şu anda meşgul, birazdan tekrar deneyin") ve ücretli çağrı yapılmaz.
3. Ücretsiz sürümü olmayan modellerin, ücretsiz karşılığı olan bir modele yönlendirilmesi (örneğin ağır düşünme modu için ücretsiz bir muadil).
4. Ayarlar tarafında ek bir seçenek eklenmez; davranış varsayılan olarak "yalnızca ücretsiz" olur.

## Teknik detaylar

- Etkilenen edge fonksiyonları: `chat`, `web-search`, `read-document`, `analyze-image`, `analyze-mood`, `generate-image`, `generate-gif`, `generate-pwa-site`, `generate-pptx`, `translate-message`, `reply-to-tre`.
- Model kimliği dönüşümü tek bir ortak yardımcıya (`_shared/model.ts`) taşınır: `toFreeModel(id)` — zaten `:free` ile bitmiyorsa ekler.
- Lovable AI Gateway fallback blokları kaldırılır ya da yalnızca `LOVABLE_ONLY` gibi açık bir bayrak varsa çalışacak şekilde kapatılır; varsayılan kapalı.
- Ücretsiz çağrı 402/429/5xx dönerse: kısa bekleme ile en fazla 2 deneme, sonra kullanıcıya Türkçe hata mesajı (ücretli çağrı yok).
- Görsel/GIF üretimi için ücretsiz sürümü bulunmayan model kullanılıyorsa, OpenRouter model listesinden ücretsiz bir görsel modeli seçilir; bulunamazsa özellik kullanıcıya "şu anda ücretsiz modelde kullanılamıyor" diye bildirilir.
- Değişiklik sonrası tüm etkilenen fonksiyonlar yeniden yayınlanır ve sohbet ile çeviri uçtan uca test edilir.
