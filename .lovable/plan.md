## Plan

1. **Sorunu doğru ele alacağım**
   - Ekran görüntüsündeki bildirim Firefox üzerinden geliyor.
   - Android’de web push inline text reply desteği Firefox’ta güvenilir/aktif değil; bu yüzden “Cevap yaz” kutusu görünmemesi beklenen bir platform sınırlaması olabilir.
   - Kod tarafında bunu kullanıcıya yanlış vaat etmeyecek şekilde netleştireceğim.

2. **Bildirim ayarları ekranını güncelleyeceğim**
   - “Android Chrome” ifadesini “Android Chrome/Edge” gibi desteklenen tarayıcılarla sınırlayacağım.
   - Firefox için: “Bildirim gelir ama bildirim çubuğundan metin cevabı desteklenmeyebilir; bildirime dokunarak uygulamadan cevap ver” açıklaması eklenecek.
   - Kullanıcı Firefox kullanıyorsa test butonu yanında kısa uyarı gösterilecek.

3. **Service worker davranışını daha sağlam yapacağım**
   - Mevcut inline reply action korunacak.
   - Eğer kullanıcı “reply” aksiyonundan boş/eksik cevapla gelirse uygulamayı ilgili sohbete açacak fallback eklenecek.
   - Böylece desteklenmeyen tarayıcıda tamamen başarısız olmak yerine kullanıcı sohbet ekranına yönlendirilir.

4. **Test bildirimi deneyimini iyileştireceğim**
   - Test bildirimi açıklamasını tarayıcıya göre uyarlayacağım:
     - Chrome/Edge: “bildirimi genişletip cevap yazabilirsin”
     - Firefox/iOS/diğer: “bildirime dokunup uygulamadan cevap verebilirsin”

## Teknik Notlar

- `public/sw.js` içinde notification click fallback’i güçlendirilecek.
- `src/hooks/usePushNotifications.ts` içinde tarayıcı algılama ve test mesajı metni güncellenecek.
- Ayarlar sayfasındaki bildirim metni ilgili dosyada bulunup sadece açıklama metinleri güncellenecek.
- Bu değişiklik Firefox’a Android sisteminin desteklemediği inline text input’u zorla ekleyemez; desteklenmeyen yerde güvenli fallback sağlar.