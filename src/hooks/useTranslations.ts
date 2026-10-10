import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getTranslations, type Translations } from '@/utils/translations';

export const useT = (): TFunction => {
  const { t } = useTranslation();
  return t;
};

export const useTranslations = (): Translations => {
  const { i18n } = useTranslation();
  return getTranslations(i18n.resolvedLanguage ?? i18n.language ?? 'tr');
};
