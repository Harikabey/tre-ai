export interface Translations {
  // Settings page
  settings: string;
  customizeApp: string;
  theme: string;
  themeDesc: string;
  lightMode: string;
  darkMode: string;
  systemMode: string;
  lightDesc: string;
  darkDesc: string;
  systemDesc: string;
  textScale: string;
  textScaleDesc: string;
  small: string;
  normal: string;
  large: string;
  extraLarge: string;
  currentScale: string;
  accessibility: string;
  accessibilityDesc: string;
  highContrast: string;
  highContrastDesc: string;
  reduceMotion: string;
  reduceMotionDesc: string;
  swipeToDelete: string;
  swipeToDeleteDesc: string;
  enableSwipe: string;
  enableSwipeDesc: string;
  screenShare: string;
  screenShareDesc: string;
  enableScreenShare: string;
  enableScreenShareDesc: string;
  emailAccess: string;
  emailAccessDesc: string;
  emailActive: string;
  remove: string;
  notConnected: string;
  connectGoogleDesc: string;
  connectGoogle: string;
  emailSecurityNote: string;
  accountSecurityNote: string;
  voiceChat: string;
  voiceChatDesc: string;
  startVoiceChat: string;
  startVoiceChatDesc: string;
  voiceSelection: string;
  voiceSelectionDesc: string;
  language: string;
  languageDesc: string;
  searchLanguage: string;
  noResults: string;
  botPersonality: string;
  botPersonalityDesc: string;
  // ChatHeader
  learning: string;
  treMemory: string;
  imageHistory: string;
  connectedAccounts: string;
  signOut: string;
  signOutSuccess: string;
  signOutError: string;
  goodbye: string;
  // EmptyState
  askAnything: string;
  teachMe: string;
  generateImage: string;
  writeStory: string;
  emptyStateDesc: string;
  // Common
  test: string;
  error: string;
  success: string;
  // Auth
  authTagline: string;
  signInTab: string;
  signUpTab: string;
  emailLabel: string;
  passwordLabel: string;
  usernameLabel: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  usernamePlaceholder: string;
  signInBtn: string;
  signUpBtn: string;
  signingInBtn: string;
  signingUpBtn: string;
  forgotPasswordLink: string;
  termsPrefix: string;
  termsLinkText: string;
  termsSuffix: string;
  termsRequiredTitle: string;
  termsRequiredDesc: string;
  welcomeBackTitle: string;
  welcomeBackDesc: string;
  accountCreatedTitle: string;
  accountCreatedDesc: string;
  validationErrorTitle: string;
  invalidEmailMsg: string;
  passwordTooShortMsg: string;
  invalidCredentialsMsg: string;
  emailNotConfirmedMsg: string;
  signInFailedMsg: string;
  emailAlreadyRegisteredMsg: string;
  signUpFailedMsg: string;
  selectLanguageLabel: string;
  // Forgot password
  forgotPasswordTitle: string;
  forgotPasswordDesc: string;
  forgotPasswordSentDesc: string;
  checkEmailInstruction: string;
  sendResetLinkBtn: string;
  sendingBtn: string;
  backToSignInBtn: string;
  resetEmailSentTitle: string;
  resetEmailSentDesc: string;
  resetEmailErrorDesc: string;
  // Reset password
  newPasswordTitle: string;
  newPasswordDesc: string;
  invalidRecoveryLinkMsg: string;
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  updatePasswordBtn: string;
  updatingBtn: string;
  passwordsDontMatchMsg: string;
  passwordUpdatedDesc: string;
  passwordUpdateErrorDesc: string;
}


const tr: Translations = {
  settings: 'Ayarlar',
  customizeApp: 'Uygulamayı özelleştirin',
  theme: 'Tema',
  themeDesc: 'Uygulama görünümünü seçin',
  lightMode: 'Açık Mod',
  darkMode: 'Koyu Mod',
  systemMode: 'Sistem',
  lightDesc: 'Aydınlık tema',
  darkDesc: 'Karanlık tema',
  systemDesc: 'Cihaz ayarlarını takip et',
  textScale: 'Yazı Ölçeği',
  textScaleDesc: 'Uygulama genelindeki yazı boyutunu ayarlayın',
  small: 'Küçük',
  normal: 'Normal',
  large: 'Büyük',
  extraLarge: 'Çok Büyük',
  currentScale: 'Mevcut ölçek',
  accessibility: 'Erişilebilirlik',
  accessibilityDesc: 'Görsel erişilebilirlik tercihlerinizi ayarlayın',
  highContrast: 'Yüksek Kontrast',
  highContrastDesc: 'Metin ve arka plan arasındaki kontrastı artırır',
  reduceMotion: 'Animasyonları Azalt',
  reduceMotionDesc: 'Geçiş efektlerini ve animasyonları en aza indirir',
  swipeToDelete: 'Kaydırarak Silme',
  swipeToDeleteDesc: 'Sohbetteki mesajları yana kaydırarak silin',
  enableSwipe: 'Kaydırarak Silmeyi Etkinleştir',
  enableSwipeDesc: 'Mesajları sola kaydırarak hızlıca silebilirsiniz',
  screenShare: 'Ekran Paylaşma',
  screenShareDesc: 'Ekranınızı AI ile paylaşarak analiz ettirin',
  enableScreenShare: 'Ekran Paylaşmayı Etkinleştir',
  enableScreenShareDesc: 'Sohbet menüsünde ekran paylaşma seçeneğini göster',
  emailAccess: 'E-posta Erişimi',
  emailAccessDesc: "Tre'nin e-postalarınızı okumasına ve yönetmesine izin verin",
  emailActive: 'E-posta Erişimi Aktif',
  remove: 'Kaldır',
  notConnected: 'Henüz bağlı değil',
  connectGoogleDesc: "Google hesabınızı bağlayarak AI'ın e-postalarınıza erişmesini sağlayın",
  connectGoogle: 'Google Hesabını Bağla',
  emailSecurityNote: "Tre e-postalarınızı okuyabilir, özetleyebilir ve taslak oluşturabilir. Erişimi istediğiniz zaman kaldırabilirsiniz.",
  accountSecurityNote: 'Hesap erişimi sadece sizin izninizle kullanılır. Verileriniz güvende tutulur.',
  voiceChat: 'Sesli Sohbet',
  voiceChatDesc: 'Sesli komutlarla AI ile sohbet edin',
  startVoiceChat: 'Sesli Sohbeti Başlat',
  startVoiceChatDesc: 'Mikrofon ile konuşarak AI ile sesli sohbet edin',
  voiceSelection: 'Ses Seçimi',
  voiceSelectionDesc: 'Bot cevaplarını sesli okutmak için bir ses seçin',
  language: 'Dil',
  languageDesc: 'Uygulama arayüz dilini seçin',
  searchLanguage: 'Dil ara...',
  noResults: 'Sonuç bulunamadı',
  botPersonality: 'Bot Kişiliği',
  botPersonalityDesc: 'Botun size nasıl yanıt vereceğini belirleyin',
  learning: 'Öğrenme',
  treMemory: 'Tre Hafızası',
  imageHistory: 'Görsel Geçmişi',
  connectedAccounts: 'Bağlı Hesaplar',
  signOut: 'Çıkış Yap',
  signOutSuccess: 'Başarıyla çıkış yaptınız',
  signOutError: 'Çıkış yapılamadı',
  goodbye: 'Görüşürüz!',
  askAnything: 'Bugün nasıl yardımcı olabilirim?',
  teachMe: 'Bana ilginç bir şey öğret',
  generateImage: '🎨 Görsel oluştur: gökyüzünde uçan balıklar',
  writeStory: 'Yaratıcı bir hikaye yaz',
  emptyStateDesc: 'Soru sorun, fikir alın, görsel oluşturun — her konuda yanınızdayım.',
  test: 'Test',
  error: 'Hata',
  success: 'Başarılı',
  authTagline: 'Akıllı AI asistanınıza hoş geldiniz',
  signInTab: 'Giriş Yap',
  signUpTab: 'Kayıt Ol',
  emailLabel: 'E-posta',
  passwordLabel: 'Şifre',
  usernameLabel: 'Kullanıcı Adı',
  emailPlaceholder: 'ornek@email.com',
  passwordPlaceholder: '••••••',
  usernamePlaceholder: 'kullaniciadi',
  signInBtn: 'Giriş Yap',
  signUpBtn: 'Kayıt Ol',
  signingInBtn: 'Giriş yapılıyor...',
  signingUpBtn: 'Kayıt olunuyor...',
  forgotPasswordLink: 'Şifremi Unuttum',
  termsPrefix: '',
  termsLinkText: 'Kullanım Sözleşmesi',
  termsSuffix: "'ni okudum ve kabul ediyorum.",
  termsRequiredTitle: 'Sözleşme Onayı Gerekli',
  termsRequiredDesc: 'Kayıt olmak için Kullanım Sözleşmesini kabul etmeniz gerekmektedir.',
  welcomeBackTitle: 'Hoş geldiniz!',
  welcomeBackDesc: 'Başarıyla giriş yaptınız',
  accountCreatedTitle: 'Hesap Oluşturuldu!',
  accountCreatedDesc: 'Başarıyla kayıt oldunuz',
  validationErrorTitle: 'Doğrulama Hatası',
  invalidEmailMsg: 'Geçerli bir e-posta adresi girin',
  passwordTooShortMsg: 'Şifre en az 6 karakter olmalı',
  invalidCredentialsMsg: 'E-posta veya şifre hatalı',
  emailNotConfirmedMsg: 'E-posta adresinizi onaylayın',
  signInFailedMsg: 'Giriş yapılamadı',
  emailAlreadyRegisteredMsg: 'Bu e-posta adresi zaten kayıtlı',
  signUpFailedMsg: 'Kayıt olunamadı',
  selectLanguageLabel: 'Dil seç',
  forgotPasswordTitle: 'Şifremi Unuttum',
  forgotPasswordDesc: 'E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim',
  forgotPasswordSentDesc: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi',
  checkEmailInstruction: 'E-postanızı kontrol edin ve şifre sıfırlama bağlantısına tıklayın.',
  sendResetLinkBtn: 'Sıfırlama Bağlantısı Gönder',
  sendingBtn: 'Gönderiliyor...',
  backToSignInBtn: 'Giriş sayfasına dön',
  resetEmailSentTitle: 'E-posta Gönderildi',
  resetEmailSentDesc: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi',
  resetEmailErrorDesc: 'Şifre sıfırlama e-postası gönderilemedi',
  newPasswordTitle: 'Yeni Şifre Belirle',
  newPasswordDesc: 'Hesabınız için yeni bir şifre oluşturun',
  invalidRecoveryLinkMsg: 'Geçersiz veya süresi dolmuş bağlantı. Lütfen yeni bir şifre sıfırlama isteği gönderin.',
  newPasswordLabel: 'Yeni Şifre',
  confirmPasswordLabel: 'Şifreyi Onayla',
  updatePasswordBtn: 'Şifreyi Güncelle',
  updatingBtn: 'Güncelleniyor...',
  passwordsDontMatchMsg: 'Şifreler eşleşmiyor',
  passwordUpdatedDesc: 'Şifreniz başarıyla güncellendi',
  passwordUpdateErrorDesc: 'Şifre güncellenemedi. Lütfen tekrar deneyin.',
};


const en: Translations = {
  settings: 'Settings',
  customizeApp: 'Customize the app',
  theme: 'Theme',
  themeDesc: 'Choose the app appearance',
  lightMode: 'Light Mode',
  darkMode: 'Dark Mode',
  systemMode: 'System',
  lightDesc: 'Light theme',
  darkDesc: 'Dark theme',
  systemDesc: 'Follow device settings',
  textScale: 'Text Scale',
  textScaleDesc: 'Adjust the text size across the app',
  small: 'Small',
  normal: 'Normal',
  large: 'Large',
  extraLarge: 'Extra Large',
  currentScale: 'Current scale',
  accessibility: 'Accessibility',
  accessibilityDesc: 'Set your visual accessibility preferences',
  highContrast: 'High Contrast',
  highContrastDesc: 'Increases contrast between text and background',
  reduceMotion: 'Reduce Motion',
  reduceMotionDesc: 'Minimizes transitions and animations',
  swipeToDelete: 'Swipe to Delete',
  swipeToDeleteDesc: 'Swipe messages sideways to delete them',
  enableSwipe: 'Enable Swipe to Delete',
  enableSwipeDesc: 'Quickly delete messages by swiping left',
  screenShare: 'Screen Share',
  screenShareDesc: 'Share your screen with AI for analysis',
  enableScreenShare: 'Enable Screen Share',
  enableScreenShareDesc: 'Show screen share option in chat menu',
  emailAccess: 'Email Access',
  emailAccessDesc: 'Allow Tre to read and manage your emails',
  emailActive: 'Email Access Active',
  remove: 'Remove',
  notConnected: 'Not connected yet',
  connectGoogleDesc: 'Connect your Google account to give AI access to your emails',
  connectGoogle: 'Connect Google Account',
  emailSecurityNote: 'Tre can read, summarize, and draft emails. You can revoke access anytime.',
  accountSecurityNote: 'Account access is only used with your permission. Your data is kept safe.',
  voiceChat: 'Voice Chat',
  voiceChatDesc: 'Chat with AI using voice commands',
  startVoiceChat: 'Start Voice Chat',
  startVoiceChatDesc: 'Chat with AI by speaking through your microphone',
  voiceSelection: 'Voice Selection',
  voiceSelectionDesc: 'Choose a voice for bot responses',
  language: 'Language',
  languageDesc: 'Choose the app interface language',
  searchLanguage: 'Search language...',
  noResults: 'No results found',
  botPersonality: 'Bot Personality',
  botPersonalityDesc: 'Choose how the bot responds to you',
  learning: 'Learning',
  treMemory: 'Tre Memory',
  imageHistory: 'Image History',
  connectedAccounts: 'Connected Accounts',
  signOut: 'Sign Out',
  signOutSuccess: 'Successfully signed out',
  signOutError: 'Could not sign out',
  goodbye: 'Goodbye!',
  askAnything: 'How can I help you today?',
  teachMe: 'Teach me something interesting',
  generateImage: '🎨 Generate image: fish flying in the sky',
  writeStory: 'Write a creative story',
  emptyStateDesc: 'Ask questions, get ideas, generate images — I\'m here for everything.',
  test: 'Test',
  error: 'Error',
  success: 'Success',
  authTagline: 'Welcome to your smart AI assistant',
  signInTab: 'Sign In',
  signUpTab: 'Sign Up',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  usernameLabel: 'Username',
  emailPlaceholder: 'example@email.com',
  passwordPlaceholder: '••••••',
  usernamePlaceholder: 'username',
  signInBtn: 'Sign In',
  signUpBtn: 'Sign Up',
  signingInBtn: 'Signing in...',
  signingUpBtn: 'Signing up...',
  forgotPasswordLink: 'Forgot Password',
  termsPrefix: 'I have read and accept the ',
  termsLinkText: 'Terms of Service',
  termsSuffix: '.',
  termsRequiredTitle: 'Terms Approval Required',
  termsRequiredDesc: 'You must accept the Terms of Service to sign up.',
  welcomeBackTitle: 'Welcome!',
  welcomeBackDesc: 'You have signed in successfully',
  accountCreatedTitle: 'Account Created!',
  accountCreatedDesc: 'You have signed up successfully',
  validationErrorTitle: 'Validation Error',
  invalidEmailMsg: 'Enter a valid email address',
  passwordTooShortMsg: 'Password must be at least 6 characters',
  invalidCredentialsMsg: 'Invalid email or password',
  emailNotConfirmedMsg: 'Please confirm your email address',
  signInFailedMsg: 'Could not sign in',
  emailAlreadyRegisteredMsg: 'This email is already registered',
  signUpFailedMsg: 'Could not sign up',
  selectLanguageLabel: 'Select language',
  forgotPasswordTitle: 'Forgot Password',
  forgotPasswordDesc: 'Enter your email and we will send you a reset link',
  forgotPasswordSentDesc: 'A password reset link has been sent to your email',
  checkEmailInstruction: 'Check your email and click the password reset link.',
  sendResetLinkBtn: 'Send Reset Link',
  sendingBtn: 'Sending...',
  backToSignInBtn: 'Back to sign in',
  resetEmailSentTitle: 'Email Sent',
  resetEmailSentDesc: 'A password reset link has been sent to your email',
  resetEmailErrorDesc: 'Could not send password reset email',
  newPasswordTitle: 'Set New Password',
  newPasswordDesc: 'Create a new password for your account',
  invalidRecoveryLinkMsg: 'Invalid or expired link. Please request a new password reset.',
  newPasswordLabel: 'New Password',
  confirmPasswordLabel: 'Confirm Password',
  updatePasswordBtn: 'Update Password',
  updatingBtn: 'Updating...',
  passwordsDontMatchMsg: 'Passwords do not match',
  passwordUpdatedDesc: 'Your password has been updated',
  passwordUpdateErrorDesc: 'Could not update password. Please try again.',
};


const de: Translations = {
  settings: 'Einstellungen',
  customizeApp: 'App anpassen',
  theme: 'Design',
  themeDesc: 'App-Erscheinungsbild wählen',
  lightMode: 'Hell',
  darkMode: 'Dunkel',
  systemMode: 'System',
  lightDesc: 'Helles Design',
  darkDesc: 'Dunkles Design',
  systemDesc: 'Geräteeinstellungen folgen',
  textScale: 'Textgröße',
  textScaleDesc: 'Textgröße in der gesamten App anpassen',
  small: 'Klein',
  normal: 'Normal',
  large: 'Groß',
  extraLarge: 'Sehr Groß',
  currentScale: 'Aktuelle Skalierung',
  accessibility: 'Barrierefreiheit',
  accessibilityDesc: 'Visuelle Barrierefreiheit einstellen',
  highContrast: 'Hoher Kontrast',
  highContrastDesc: 'Erhöht den Kontrast zwischen Text und Hintergrund',
  reduceMotion: 'Bewegung reduzieren',
  reduceMotionDesc: 'Übergänge und Animationen minimieren',
  swipeToDelete: 'Wischen zum Löschen',
  swipeToDeleteDesc: 'Nachrichten durch Wischen löschen',
  enableSwipe: 'Wischen zum Löschen aktivieren',
  enableSwipeDesc: 'Nachrichten durch Linkswischen schnell löschen',
  screenShare: 'Bildschirmfreigabe',
  screenShareDesc: 'Teilen Sie Ihren Bildschirm mit der KI zur Analyse',
  enableScreenShare: 'Bildschirmfreigabe aktivieren',
  enableScreenShareDesc: 'Option zur Bildschirmfreigabe im Chat-Menü anzeigen',
  emailAccess: 'E-Mail-Zugriff',
  emailAccessDesc: 'Erlauben Sie Tre, Ihre E-Mails zu lesen und zu verwalten',
  emailActive: 'E-Mail-Zugriff aktiv',
  remove: 'Entfernen',
  notConnected: 'Noch nicht verbunden',
  connectGoogleDesc: 'Verbinden Sie Ihr Google-Konto, um der KI Zugriff auf Ihre E-Mails zu geben',
  connectGoogle: 'Google-Konto verbinden',
  emailSecurityNote: 'Tre kann E-Mails lesen, zusammenfassen und Entwürfe erstellen. Zugriff jederzeit widerrufbar.',
  accountSecurityNote: 'Kontozugriff wird nur mit Ihrer Erlaubnis verwendet. Ihre Daten sind sicher.',
  voiceChat: 'Sprachchat',
  voiceChatDesc: 'Mit KI per Sprachbefehle chatten',
  startVoiceChat: 'Sprachchat starten',
  startVoiceChatDesc: 'Sprechen Sie über das Mikrofon mit der KI',
  voiceSelection: 'Stimmauswahl',
  voiceSelectionDesc: 'Wählen Sie eine Stimme für Bot-Antworten',
  language: 'Sprache',
  languageDesc: 'Sprache der App-Oberfläche wählen',
  searchLanguage: 'Sprache suchen...',
  noResults: 'Keine Ergebnisse gefunden',
  botPersonality: 'Bot-Persönlichkeit',
  botPersonalityDesc: 'Bestimmen Sie, wie der Bot antwortet',
  learning: 'Lernen',
  treMemory: 'Tre Gedächtnis',
  imageHistory: 'Bildverlauf',
  connectedAccounts: 'Verbundene Konten',
  signOut: 'Abmelden',
  signOutSuccess: 'Erfolgreich abgemeldet',
  signOutError: 'Abmeldung fehlgeschlagen',
  goodbye: 'Auf Wiedersehen!',
  askAnything: 'Wie kann ich Ihnen heute helfen?',
  teachMe: 'Lehre mich etwas Interessantes',
  generateImage: '🎨 Bild erstellen: fliegende Fische am Himmel',
  writeStory: 'Schreibe eine kreative Geschichte',
  emptyStateDesc: 'Stellen Sie Fragen, holen Sie sich Ideen, erstellen Sie Bilder — ich bin für alles da.',
  test: 'Test',
  error: 'Fehler',
  success: 'Erfolgreich',
  authTagline: 'Willkommen bei Ihrem smarten KI-Assistenten',
  signInTab: 'Anmelden',
  signUpTab: 'Registrieren',
  emailLabel: 'E-Mail',
  passwordLabel: 'Passwort',
  usernameLabel: 'Benutzername',
  emailPlaceholder: 'beispiel@email.com',
  passwordPlaceholder: '••••••',
  usernamePlaceholder: 'benutzername',
  signInBtn: 'Anmelden',
  signUpBtn: 'Registrieren',
  signingInBtn: 'Anmeldung läuft...',
  signingUpBtn: 'Registrierung läuft...',
  forgotPasswordLink: 'Passwort vergessen',
  termsPrefix: 'Ich habe die ',
  termsLinkText: 'Nutzungsbedingungen',
  termsSuffix: ' gelesen und akzeptiert.',
  termsRequiredTitle: 'Zustimmung erforderlich',
  termsRequiredDesc: 'Sie müssen die Nutzungsbedingungen akzeptieren, um sich zu registrieren.',
  welcomeBackTitle: 'Willkommen!',
  welcomeBackDesc: 'Sie haben sich erfolgreich angemeldet',
  accountCreatedTitle: 'Konto erstellt!',
  accountCreatedDesc: 'Sie haben sich erfolgreich registriert',
  validationErrorTitle: 'Validierungsfehler',
  invalidEmailMsg: 'Geben Sie eine gültige E-Mail-Adresse ein',
  passwordTooShortMsg: 'Das Passwort muss mindestens 6 Zeichen haben',
  invalidCredentialsMsg: 'Ungültige E-Mail oder Passwort',
  emailNotConfirmedMsg: 'Bitte bestätigen Sie Ihre E-Mail-Adresse',
  signInFailedMsg: 'Anmeldung fehlgeschlagen',
  emailAlreadyRegisteredMsg: 'Diese E-Mail ist bereits registriert',
  signUpFailedMsg: 'Registrierung fehlgeschlagen',
  selectLanguageLabel: 'Sprache wählen',
  forgotPasswordTitle: 'Passwort vergessen',
  forgotPasswordDesc: 'Geben Sie Ihre E-Mail ein und wir senden Ihnen einen Link zum Zurücksetzen',
  forgotPasswordSentDesc: 'Ein Link zum Zurücksetzen wurde an Ihre E-Mail gesendet',
  checkEmailInstruction: 'Überprüfen Sie Ihre E-Mail und klicken Sie auf den Link.',
  sendResetLinkBtn: 'Link senden',
  sendingBtn: 'Wird gesendet...',
  backToSignInBtn: 'Zurück zur Anmeldung',
  resetEmailSentTitle: 'E-Mail gesendet',
  resetEmailSentDesc: 'Ein Link zum Zurücksetzen wurde an Ihre E-Mail gesendet',
  resetEmailErrorDesc: 'Passwort-Reset-E-Mail konnte nicht gesendet werden',
  newPasswordTitle: 'Neues Passwort festlegen',
  newPasswordDesc: 'Erstellen Sie ein neues Passwort für Ihr Konto',
  invalidRecoveryLinkMsg: 'Ungültiger oder abgelaufener Link. Bitte fordern Sie eine neue Zurücksetzung an.',
  newPasswordLabel: 'Neues Passwort',
  confirmPasswordLabel: 'Passwort bestätigen',
  updatePasswordBtn: 'Passwort aktualisieren',
  updatingBtn: 'Wird aktualisiert...',
  passwordsDontMatchMsg: 'Passwörter stimmen nicht überein',
  passwordUpdatedDesc: 'Ihr Passwort wurde aktualisiert',
  passwordUpdateErrorDesc: 'Passwort konnte nicht aktualisiert werden. Bitte erneut versuchen.',
};


const fr: Translations = {
  settings: 'Paramètres',
  customizeApp: "Personnaliser l'application",
  theme: 'Thème',
  themeDesc: "Choisir l'apparence de l'application",
  lightMode: 'Clair',
  darkMode: 'Sombre',
  systemMode: 'Système',
  lightDesc: 'Thème clair',
  darkDesc: 'Thème sombre',
  systemDesc: "Suivre les paramètres de l'appareil",
  textScale: 'Taille du texte',
  textScaleDesc: "Ajuster la taille du texte dans l'application",
  small: 'Petit',
  normal: 'Normal',
  large: 'Grand',
  extraLarge: 'Très Grand',
  currentScale: 'Échelle actuelle',
  accessibility: 'Accessibilité',
  accessibilityDesc: "Définir vos préférences d'accessibilité visuelle",
  highContrast: 'Contraste élevé',
  highContrastDesc: 'Augmente le contraste entre le texte et le fond',
  reduceMotion: 'Réduire les animations',
  reduceMotionDesc: 'Minimise les transitions et animations',
  swipeToDelete: 'Glisser pour supprimer',
  swipeToDeleteDesc: 'Glissez les messages pour les supprimer',
  enableSwipe: 'Activer glisser pour supprimer',
  enableSwipeDesc: 'Supprimez rapidement les messages en glissant vers la gauche',
  screenShare: "Partage d'écran",
  screenShareDesc: "Partagez votre écran avec l'IA pour analyse",
  enableScreenShare: "Activer le partage d'écran",
  enableScreenShareDesc: "Afficher l'option de partage d'écran dans le menu",
  emailAccess: 'Accès e-mail',
  emailAccessDesc: 'Autoriser Tre à lire et gérer vos e-mails',
  emailActive: 'Accès e-mail actif',
  remove: 'Supprimer',
  notConnected: 'Pas encore connecté',
  connectGoogleDesc: "Connectez votre compte Google pour donner accès à vos e-mails à l'IA",
  connectGoogle: 'Connecter un compte Google',
  emailSecurityNote: 'Tre peut lire, résumer et rédiger des e-mails. Vous pouvez révoquer l\'accès à tout moment.',
  accountSecurityNote: "L'accès au compte n'est utilisé qu'avec votre permission. Vos données sont protégées.",
  voiceChat: 'Chat vocal',
  voiceChatDesc: "Discutez avec l'IA par commandes vocales",
  startVoiceChat: 'Démarrer le chat vocal',
  startVoiceChatDesc: "Parlez à l'IA via votre microphone",
  voiceSelection: 'Sélection de voix',
  voiceSelectionDesc: 'Choisissez une voix pour les réponses du bot',
  language: 'Langue',
  languageDesc: "Choisir la langue de l'interface",
  searchLanguage: 'Rechercher une langue...',
  noResults: 'Aucun résultat trouvé',
  botPersonality: 'Personnalité du bot',
  botPersonalityDesc: 'Choisissez comment le bot vous répond',
  learning: 'Apprentissage',
  treMemory: 'Mémoire de Tre',
  imageHistory: 'Historique des images',
  connectedAccounts: 'Comptes connectés',
  signOut: 'Se déconnecter',
  signOutSuccess: 'Déconnexion réussie',
  signOutError: 'Échec de la déconnexion',
  goodbye: 'Au revoir !',
  askAnything: "Comment puis-je vous aider aujourd'hui ?",
  teachMe: "Apprends-moi quelque chose d'intéressant",
  generateImage: '🎨 Générer une image : poissons volants dans le ciel',
  writeStory: 'Écris une histoire créative',
  emptyStateDesc: "Posez des questions, obtenez des idées, générez des images — je suis là pour tout.",
  test: 'Test',
  error: 'Erreur',
};

const es: Translations = {
  settings: 'Configuración',
  customizeApp: 'Personalizar la aplicación',
  theme: 'Tema',
  themeDesc: 'Elige la apariencia de la aplicación',
  lightMode: 'Claro',
  darkMode: 'Oscuro',
  systemMode: 'Sistema',
  lightDesc: 'Tema claro',
  darkDesc: 'Tema oscuro',
  systemDesc: 'Seguir ajustes del dispositivo',
  textScale: 'Escala de texto',
  textScaleDesc: 'Ajustar el tamaño del texto en la aplicación',
  small: 'Pequeño',
  normal: 'Normal',
  large: 'Grande',
  extraLarge: 'Muy Grande',
  currentScale: 'Escala actual',
  accessibility: 'Accesibilidad',
  accessibilityDesc: 'Configurar preferencias de accesibilidad visual',
  highContrast: 'Alto contraste',
  highContrastDesc: 'Aumenta el contraste entre texto y fondo',
  reduceMotion: 'Reducir movimiento',
  reduceMotionDesc: 'Minimiza transiciones y animaciones',
  swipeToDelete: 'Deslizar para eliminar',
  swipeToDeleteDesc: 'Desliza los mensajes para eliminarlos',
  enableSwipe: 'Activar deslizar para eliminar',
  enableSwipeDesc: 'Elimina mensajes rápidamente deslizando a la izquierda',
  screenShare: 'Compartir pantalla',
  screenShareDesc: 'Comparte tu pantalla con la IA para análisis',
  enableScreenShare: 'Activar compartir pantalla',
  enableScreenShareDesc: 'Mostrar opción de compartir pantalla en el menú',
  emailAccess: 'Acceso al correo',
  emailAccessDesc: 'Permitir que Tre lea y gestione tus correos',
  emailActive: 'Acceso al correo activo',
  remove: 'Eliminar',
  notConnected: 'Aún no conectado',
  connectGoogleDesc: 'Conecta tu cuenta de Google para dar acceso a tus correos a la IA',
  connectGoogle: 'Conectar cuenta de Google',
  emailSecurityNote: 'Tre puede leer, resumir y redactar correos. Puedes revocar el acceso en cualquier momento.',
  accountSecurityNote: 'El acceso a la cuenta solo se usa con tu permiso. Tus datos están seguros.',
  voiceChat: 'Chat de voz',
  voiceChatDesc: 'Chatea con la IA usando comandos de voz',
  startVoiceChat: 'Iniciar chat de voz',
  startVoiceChatDesc: 'Habla con la IA a través de tu micrófono',
  voiceSelection: 'Selección de voz',
  voiceSelectionDesc: 'Elige una voz para las respuestas del bot',
  language: 'Idioma',
  languageDesc: 'Elige el idioma de la interfaz',
  searchLanguage: 'Buscar idioma...',
  noResults: 'No se encontraron resultados',
  botPersonality: 'Personalidad del bot',
  botPersonalityDesc: 'Elige cómo te responde el bot',
  learning: 'Aprendizaje',
  treMemory: 'Memoria de Tre',
  imageHistory: 'Historial de imágenes',
  connectedAccounts: 'Cuentas conectadas',
  signOut: 'Cerrar sesión',
  signOutSuccess: 'Sesión cerrada correctamente',
  signOutError: 'No se pudo cerrar sesión',
  goodbye: '¡Adiós!',
  askAnything: '¿Cómo puedo ayudarte hoy?',
  teachMe: 'Enséñame algo interesante',
  generateImage: '🎨 Generar imagen: peces volando en el cielo',
  writeStory: 'Escribe una historia creativa',
  emptyStateDesc: 'Haz preguntas, obtén ideas, genera imágenes — estoy aquí para todo.',
  test: 'Test',
  error: 'Error',
};

// Hardcoded translations
const hardcodedTranslations: Record<string, Translations> = {
  tr, en, de, fr, es,
};

const CACHE_KEY_PREFIX = 'ui_translations_cache_';
const CACHE_VERSION = 'v1';

function getCacheKey(langCode: string): string {
  return `${CACHE_KEY_PREFIX}${CACHE_VERSION}_${langCode}`;
}

function getCachedTranslation(langCode: string): Translations | null {
  try {
    const cached = localStorage.getItem(getCacheKey(langCode));
    if (cached) {
      return JSON.parse(cached) as Translations;
    }
  } catch {}
  return null;
}

function setCachedTranslation(langCode: string, translations: Translations): void {
  try {
    localStorage.setItem(getCacheKey(langCode), JSON.stringify(translations));
  } catch {}
}

// Translate all UI strings dynamically using the translate-message edge function
export async function translateUIStrings(targetLanguage: string): Promise<Translations | null> {
  // Check cache first
  const cached = getCachedTranslation(targetLanguage);
  if (cached) return cached;

  try {
    const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const { getLanguageByCode } = await import('@/types/language');
    const langInfo = getLanguageByCode(targetLanguage);

    // Send all English strings as a JSON block to translate in one call
    const textToTranslate = JSON.stringify(en);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: textToTranslate,
          targetLanguage: langInfo.nativeName,
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const translatedText = data.translatedText || '';

    // Parse the translated JSON
    // The AI might wrap it in markdown code blocks, so clean it
    const cleaned = translatedText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned) as Translations;

    // Validate that all keys exist
    const allKeys = Object.keys(en) as (keyof Translations)[];
    const isValid = allKeys.every(key => typeof parsed[key] === 'string' && parsed[key].length > 0);

    if (isValid) {
      setCachedTranslation(targetLanguage, parsed);
      return parsed;
    }

    // If some keys are missing, fill them from English
    const merged = { ...en };
    for (const key of allKeys) {
      if (typeof parsed[key] === 'string' && parsed[key].length > 0) {
        merged[key] = parsed[key];
      }
    }
    setCachedTranslation(targetLanguage, merged);
    return merged;
  } catch (err) {
    console.error('Dynamic translation failed:', err);
    return null;
  }
}

export function getTranslations(langCode: string): Translations {
  // Return hardcoded if available
  if (hardcodedTranslations[langCode]) {
    return hardcodedTranslations[langCode];
  }

  // Check localStorage cache for dynamically translated strings
  const cached = getCachedTranslation(langCode);
  if (cached) return cached;

  // Fallback to English (dynamic translation will be triggered separately)
  return en;
}

export function useTranslations(): Translations {
  const lang = localStorage.getItem('ai_chatbot_language') || 'tr';
  return getTranslations(lang);
}
