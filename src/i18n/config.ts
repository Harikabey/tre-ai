import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import tr from '@/locales/tr.json';
import { languages } from '@/types/language';

export const LANGUAGE_STORAGE_KEY = 'tre_language';
const LEGACY_LANGUAGE_STORAGE_KEY = 'ai_chatbot_language';
export const supportedLanguages = languages.map(({ code }) => code);

const readInitialLanguage = (): string => {
  try {
    const storedLanguage =
      localStorage.getItem(LANGUAGE_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
    return storedLanguage && supportedLanguages.includes(storedLanguage) ? storedLanguage : 'tr';
  } catch {
    return 'tr';
  }
};

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: readInitialLanguage(),
  fallbackLng: 'tr',
  supportedLngs: supportedLanguages,
  keySeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  initImmediate: false,
});

export default i18n;
