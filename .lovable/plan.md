## Amaç
Giriş (Sign In) ve Kayıt (Sign Up) ekranlarındaki tüm metinleri, uygulamada zaten kullanılan çeviri sistemine bağlayarak dil desteği eklemek. Ayrıca ekranın üstüne küçük bir dil seçici koyarak kullanıcı, giriş yapmadan önce arayüz dilini değiştirebilsin.

## Kapsam
Sadece `src/pages/Auth.tsx`, `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx` ve `src/utils/translations.ts`. Backend / auth mantığı değişmez, sadece görünen metinler.

## Yapılacaklar

1. **Çeviri anahtarları ekle** (`src/utils/translations.ts`)
   - `Translations` interface'ine auth ile ilgili anahtarlar eklenecek:
     - `signIn`, `signUp`, `email`, `password`, `usernameLabel`, `usernamePlaceholder`, `emailPlaceholder`, `passwordPlaceholder`
     - `signingIn`, `signingUp`, `welcomeBack`, `signInSuccess`, `accountCreated`, `signUpSuccess`
     - `forgotPassword`, `authTagline` ("Akıllı AI asistanınıza hoş geldiniz")
     - `termsAcceptRequired`, `termsAcceptDesc` (checkbox etrafındaki metin, `{terms}` placeholder ile)
     - `termsLinkText` ("Kullanım Sözleşmesi")
     - Hata mesajları: `invalidEmail`, `passwordTooShort`, `invalidCredentials`, `emailNotConfirmed`, `emailAlreadyRegistered`, `signInFailed`, `signUpFailed`, `validationError`
     - ForgotPassword/ResetPassword: `resetPasswordTitle`, `resetPasswordDesc`, `sendResetLink`, `resetLinkSent`, `newPassword`, `confirmPassword`, `updatePassword`, `passwordUpdated`, `passwordsDontMatch`, `backToSignIn`
   - Aynı anahtarlar `tr`, `en`, `de`, `fr`, `es` sabitlerine eklenecek. Dinamik diller zaten `translateUIStrings` üzerinden otomatik çevrildiği için ek çalışma gerekmez.

2. **`Auth.tsx` güncelle**
   - `getTranslations(localStorage.getItem('ai_chatbot_language') || 'tr')` ile `t` alınacak.
   - Tüm sabit Türkçe metinler `t.*` ile değiştirilecek (başlık, açıklama, tab isimleri, input label/placeholder, buton metinleri, toast mesajları, terms checkbox).
   - Zod hata mesajları da `t.invalidEmail` / `t.passwordTooShort` kullanacak.
   - Sağ üst köşeye küçük bir dil seçici `Select` eklenecek (mevcut Settings'teki dil listesinden ilk ~10-15 popüler dil): seçim `localStorage`'a yazılır ve sayfa `window.location.reload()` ile yenilenir. Böylece giriş öncesi dil değiştirilebilir.

3. **`ForgotPassword.tsx` ve `ResetPassword.tsx` güncelle**
   - Aynı `getTranslations` deseni ile tüm metinler ve toast'lar çevrilecek. Dil seçici eklenmez (Auth sayfasındaki seçim burada da geçerli olur, çünkü aynı localStorage anahtarı).

## Teknik Notlar
- `getTranslations` bilinmeyen dil kodunda `tr`'ye düşer, bu yüzden dinamik dillerde bile en azından Türkçe fallback çalışır. Dinamik diller için önceden cache'lenmiş `ui_translations_cache_*` varsa otomatik kullanılır (mevcut davranış, dokunulmaz).
- Toast mesaj başlıkları da (`Hoş geldiniz!`, `Hata`, `Hesap Oluşturuldu!`) çevrilecek — yeni anahtarlarla.
- Terms checkbox metni JSX içinde `t.termsAcceptDesc` bir cümle + tıklanabilir link olarak bölünecek: `{prefix}<button>{t.termsLinkText}</button>{suffix}` formatı; iki ayrı anahtar (`termsAcceptPrefix`, `termsAcceptSuffix`) kullanılacak.
- Backend, Supabase auth çağrıları, yönlendirmeler, validation kuralları değişmez.

## Dokunulmayacaklar
- `useAuth` hook'u
- Supabase client ve auth akışı
- `TermsOfServiceDialog` içeriği (kendi içinde ayrı bir görev)
