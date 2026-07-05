## Hatırlatıcı Sistemini Test Etme Planı

Hatırlatıcı akışının uçtan uca çalıştığını doğrulamak için aşağıdaki adımları uygulayacağım:

### 1. Ön Kontroller
- `reminders` tablosunun yapısını ve RLS politikalarını doğrula (`supabase--read_query`)
- Cron job'ın (`pg_cron`) `dispatch-reminders` fonksiyonunu her dakika çağıracak şekilde kurulu olup olmadığını kontrol et; kurulu değilse kur
- Kullanıcının aktif bir `push_subscriptions` kaydı var mı bak (yoksa test bildirimi ulaşmaz)

### 2. `create-reminder` Fonksiyonunu Test Et
- `supabase--curl_edge_functions` ile giriş yapmış kullanıcı token'ıyla çağır
- Örnek payload: `{ text: "1 dakika sonra test hatırlatıcısı", timezone: "Europe/Istanbul" }`
- Dönen `remind_at` alanının yaklaşık +1 dk sonrasını gösterdiğini ve DB'ye satırın düştüğünü `read_query` ile doğrula
- Edge function loglarını kontrol et (AI extract adımı hatasız mı)

### 3. `dispatch-reminders` Fonksiyonunu Test Et
- Zamanı geçmiş reminder oluştuktan sonra elle bir kez tetikle (`curl_edge_functions`)
- Dönen `dispatched` sayısını kontrol et
- DB'de ilgili satırın `sent=true`, `sent_at` dolu olduğunu doğrula
- `send-push` loglarında başarılı gönderim veya (abonelik yoksa) `sent: 0` mesajı görünmeli

### 4. Uçtan Uca (Gerçek Bildirim)
- Kullanıcının push aboneliği varsa: yeni bir "2 dakika sonra" hatırlatıcı oluştur, cron'un tetiklemesini bekle, cihazda bildirimin geldiğini kullanıcı teyit etsin
- Yoksa: kullanıcıya Ayarlar > Bildirimler'i açması ve yayınlanmış URL'de (`tre-ai.lovable.app`) test etmesi hatırlatılır (preview'da web push çalışmıyor)

### 5. Sonuç Raporu
- Her adımın çıktısını (DB satırı, function log, dispatched sayısı) kısa bir özet olarak sunacağım
- Bulunan hata varsa ayrı bir düzeltme planı önereceğim

### Teknik Detay
Kod değişikliği yapılmayacak — yalnızca test/gözlem araçları (`supabase--read_query`, `curl_edge_functions`, `edge_function_logs`, gerekirse `supabase--insert` ile cron kurulumu) kullanılacak.