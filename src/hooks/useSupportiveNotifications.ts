import { useCallback, useEffect, useRef, useState } from 'react';

export const SUPPORTIVE_NOTIFICATIONS_KEY = 'tre_supportive_notifications';
export const SUPPORTIVE_NOTIFICATIONS_CHANGED_EVENT = 'tre-supportive-notifications-changed';

export interface SupportiveNotificationSettings {
  masterEnabled: boolean;
  streakReminder: boolean;
  missYou: boolean;
  journey: boolean;
  socialProof: boolean;
  curiosity: boolean;
  easterEgg: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dailyLimit: number;
}

export type SupportiveNotificationType =
  | 'streakReminder'
  | 'missYou'
  | 'journey'
  | 'socialProof'
  | 'curiosity'
  | 'easterEgg';

export type SupportiveNotificationSettingKey = keyof SupportiveNotificationSettings;
export type SupportiveNotificationSettingValue<K extends SupportiveNotificationSettingKey> =
  SupportiveNotificationSettings[K];

const defaults: SupportiveNotificationSettings = {
  masterEnabled: true,
  streakReminder: true,
  missYou: true,
  journey: true,
  socialProof: true,
  curiosity: true,
  easterEgg: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '08:00',
  dailyLimit: 3,
};

const booleanKeys: SupportiveNotificationSettingKey[] = [
  'masterEnabled',
  'streakReminder',
  'missYou',
  'journey',
  'socialProof',
  'curiosity',
  'easterEgg',
  'quietHoursEnabled',
];

function isTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function normalizeSettings(value: unknown): SupportiveNotificationSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  if (
    booleanKeys.some((key) => typeof parsed[key] !== 'boolean') ||
    !isTime(parsed.quietHoursStart) ||
    !isTime(parsed.quietHoursEnd) ||
    typeof parsed.dailyLimit !== 'number' ||
    !Number.isFinite(parsed.dailyLimit)
  ) return null;

  return {
    masterEnabled: parsed.masterEnabled as boolean,
    streakReminder: parsed.streakReminder as boolean,
    missYou: parsed.missYou as boolean,
    journey: parsed.journey as boolean,
    socialProof: parsed.socialProof as boolean,
    curiosity: parsed.curiosity as boolean,
    easterEgg: parsed.easterEgg as boolean,
    quietHoursEnabled: parsed.quietHoursEnabled as boolean,
    quietHoursStart: parsed.quietHoursStart,
    quietHoursEnd: parsed.quietHoursEnd,
    dailyLimit: Math.min(10, Math.max(1, Math.floor(parsed.dailyLimit))),
  };
}

export function readSupportiveNotificationSettings(): SupportiveNotificationSettings {
  try {
    const stored = window.localStorage.getItem(SUPPORTIVE_NOTIFICATIONS_KEY);
    if (stored === null) return { ...defaults };
    const parsed: unknown = JSON.parse(stored);
    const normalized = normalizeSettings(parsed);
    if (normalized) return normalized;
    console.warn('Destekleyici bildirim ayarları geçersiz; varsayılanlar kullanılıyor.');
  } catch (error) {
    console.warn('Destekleyici bildirim ayarları okunamadı; varsayılanlar kullanılıyor.', error);
  }
  return { ...defaults };
}

function persistSettings(settings: SupportiveNotificationSettings): void {
  try {
    window.localStorage.setItem(SUPPORTIVE_NOTIFICATIONS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(SUPPORTIVE_NOTIFICATIONS_CHANGED_EVENT));
  } catch (error) {
    console.warn('Destekleyici bildirim ayarları kaydedilemedi.', error);
  }
}

export function useSupportiveNotifications() {
  const [settings, setSettings] = useState<SupportiveNotificationSettings>(readSupportiveNotificationSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const syncSettings = () => {
      const next = readSupportiveNotificationSettings();
      if (JSON.stringify(next) === JSON.stringify(settingsRef.current)) return;
      settingsRef.current = next;
      setSettings(next);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SUPPORTIVE_NOTIFICATIONS_KEY || event.key === null) syncSettings();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(SUPPORTIVE_NOTIFICATIONS_CHANGED_EVENT, syncSettings);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SUPPORTIVE_NOTIFICATIONS_CHANGED_EVENT, syncSettings);
    };
  }, []);

  const updateSetting = useCallback(<K extends SupportiveNotificationSettingKey>(
    key: K,
    value: SupportiveNotificationSettingValue<K>,
  ) => {
    let normalizedValue: SupportiveNotificationSettings[K] = value;
    if (key === 'quietHoursStart' && !isTime(value)) {
      normalizedValue = '23:00' as SupportiveNotificationSettings[K];
    } else if (key === 'quietHoursEnd' && !isTime(value)) {
      normalizedValue = '08:00' as SupportiveNotificationSettings[K];
    } else if (key === 'dailyLimit' && typeof value === 'number') {
      normalizedValue = (Number.isFinite(value)
        ? Math.min(10, Math.max(1, Math.floor(value)))
        : defaults.dailyLimit) as SupportiveNotificationSettings[K];
    }

    const next = { ...settingsRef.current, [key]: normalizedValue };
    settingsRef.current = next;
    setSettings(next);
    persistSettings(next);
  }, []);

  const toggleMaster = useCallback(() => {
    updateSetting('masterEnabled', !settingsRef.current.masterEnabled);
  }, [updateSetting]);

  const isEnabled = useCallback((key: SupportiveNotificationType) => (
    settingsRef.current.masterEnabled && settingsRef.current[key]
  ), []);

  const resetSettings = useCallback(() => {
    const next = { ...defaults };
    settingsRef.current = next;
    setSettings(next);
    persistSettings(next);
  }, []);

  return { settings, updateSetting, toggleMaster, isEnabled, resetSettings };
}
