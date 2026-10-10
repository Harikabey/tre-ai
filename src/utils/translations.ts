import { useTranslation } from 'react-i18next';
import deLocale from '@/locales/de.json';
import enLocale from '@/locales/en.json';
import esLocale from '@/locales/es.json';
import frLocale from '@/locales/fr.json';
import trLocale from '@/locales/tr.json';

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

















const tr: Translations = trLocale;
const en: Translations = enLocale;
const de: Translations = deLocale;
const fr: Translations = frLocale;
const es: Translations = esLocale;

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
  } catch (error) {
    console.warn('Unable to read cached translations:', error);
  }
  return null;
}

function setCachedTranslation(langCode: string, translations: Translations): void {
  try {
    localStorage.setItem(getCacheKey(langCode), JSON.stringify(translations));
  } catch (error) {
    console.warn('Unable to cache translations:', error);
  }
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

  // Unsupported or uncached languages fall back to Turkish.
  return tr;
}

export function useTranslations(): Translations {
  const { i18n } = useTranslation();
  return getTranslations(i18n.resolvedLanguage ?? i18n.language ?? 'tr');
}
