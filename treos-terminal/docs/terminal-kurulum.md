# TreOS Terminal Aracı — Kurulum Rehberi

## 📥 1. İndirme

TreOS ana sayfasında **"Terminal Aracını İndir"** düğmesine tıklayın. `treos-terminal.exe` dosyası bilgisayarınıza inecektir.

> **Not:** Dosya boyutu yaklaşık 20-30 MB'dir. İndirme tamamlandığında dosyayı çalıştırmadan önce antivirüs yazılımınızın uyarı vermediğinden emin olun. PyInstaller ile paketlenmiş dosyalar bazen yanlış pozitif uyarı verebilir; dosyayı "güvenli" olarak işaretlemeniz gerekebilir.

---

## 🚀 2. İlk Çalıştırma

1. İndirdiğiniz `treos-terminal.exe` dosyasına çift tıklayın.
2. Windows güvenlik uyarısı çıkarsa **"Daha fazla bilgi"** → **"Yine de çalıştır"** seçeneğine tıklayın.
3. Terminal penceresi açılacaktır. Arayüz basittir: üstte başlık, ortada sohbet alanı, altta giriş kutusu.

---

## 🔑 3. API Anahtarı Girişi

İlk açılışta sizden bir API anahtarı girmeniz istenecektir:

```
API anahtarınızı girin (Groq veya OpenRouter):
> _
```

### Hangi anahtarı kullanmalıyım?

| Sağlayıcı | Ücretsiz Kota | Anahtar Alma Adresi |
|-----------|---------------|---------------------|
| Groq | Ücretsiz kullanım mevcut | [console.groq.com](https://console.groq.com) |
| OpenRouter | Ücretsiz modeller mevcut | [openrouter.ai/keys](https://openrouter.ai/keys) |

Anahtarınızı yapıştırın ve **Enter**'a basın. Anahtar yerel olarak `C:\Users\<kullanıcı>\.treos\config.json` dosyasına kaydedilir ve bir daha sorulmaz.

> **Güvenlik notu:** Anahtarınız yalnızca bilgisayarınızda saklanır, TreOS sunucularına gönderilmez. Dosyayı başkalarıyla paylaşmayın.

---

## 💬 4. Kullanmaya Başlama

Anahtar girildikten sonra sohbet ekranı açılır. Doğal dilde isteğinizi yazın:

```
> Notepad'i aç ve masaüstüne bir not dosyası oluştur
```

Sistem, isteğinizi yapay zekaya gönderir ve yanıt olarak bir yapılacaklar listesi gösterir:

```
┌─────────────────────────────────────────────────────┐
│  YAPILACAKLAR                                       │
├─────────────────────────────────────────────────────┤
│  1. Uygulama açılacak: notepad.exe                  │
│     Sebep: Notepad'i aç                              │
│                                                     │
│  2. Dosya yazılacak: C:\Users\...\Desktop\not.txt   │
│     Sebep: Masaüstüne not dosyası oluştur           │
└─────────────────────────────────────────────────────┘

Devam etmek istiyor musunuz? (y/n): _
```

**`y`** tuşuna basarsanız işlemler sırayla gerçekleştirilir. **`n`** tuşuna basarsanız hiçbir şey yapılmaz.

---

## ⚠️ 5. Güvenlik Kuralları

- **Her işlem önceden gösterilir.** Ne yapılacağını görmeden hiçbir komut çalışmaz.
- **Tehlikeli komutlar engellenir.** Format, disk silme gibi komutlar kara listede olup hiç gösterilmez.
- **API anahtarınız gizlidir.** Anahtar yalnızca yerel dosyada saklanır, TreOS'a gönderilmez.
- **Şüpheli durumda `n` deyin.** Emin değilseniz işlemi iptal edin, farklı bir ifadeyle tekrar deneyin.

---

## 🔧 6. Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|-------|-------|
| "API anahtarı geçersiz" hatası | Anahtarın doğru kopyalandığından emin olun, başında/sonunda boşluk olmasın |
| Program açılmıyor | Antivirüsü geçici olarak devre dışı bırakın veya dosyayı istisna listesine ekleyin |
| "Model geçersiz format döndürdü" | İsteğinizi daha net yazın, tekrar deneyin |
| Anahtarı değiştirmek istiyorum | `treos-terminal --reset-key` komutunu çalıştırın veya `~/.treos/config.json` dosyasını silin |

---

## 📌 7. Kısayollar

| Tuş | İşlev |
|-----|-------|
| `Enter` | İsteği gönder |
| `Ctrl+C` | Programdan çık |
| `Ctrl+L` | Ekranı temizle |
| `Ctrl+R` | API anahtarını sıfırla |
| `y` / `n` | Onay / iptal |
