import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGE_STORAGE_KEY, supportedLanguages } from '@/i18n/config';

const LEGACY_LANGUAGE_STORAGE_KEY = 'ai_chatbot_language';

interface LanguageContextValue {
  language: string;
  setLanguage: (language: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const { i18n: translationInstance } = useTranslation();
  const [language, setCurrentLanguage] = useState(translationInstance.resolvedLanguage ?? 'tr');

  const setLanguage = useCallback(async (nextLanguage: string) => {
    if (!supportedLanguages.includes(nextLanguage)) {
      throw new RangeError(`Unsupported language: ${nextLanguage}`);
    }

    await i18n.changeLanguage(nextLanguage);
    setCurrentLanguage(nextLanguage);

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.error('Unable to persist the selected language:', error);
    }
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
