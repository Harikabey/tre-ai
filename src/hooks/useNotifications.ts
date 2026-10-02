import { useCallback, useEffect, useState } from 'react';
import {
  getPermissionStatus,
  isNotificationSupported,
  NOTIFICATION_SETTINGS_KEY,
  readNotificationSettings,
  registerServiceWorker,
  requestPermission,
  showLocalNotification,
  subscribeToPush,
  unsubscribeFromPush,
  writeNotificationSettings,
  type NotificationPermission,
  type NotificationSettings,
} from '@/lib/notification-manager';

export interface UseNotificationsResult {
  permission: NotificationPermission;
  masterEnabled: boolean;
  isSupported: boolean;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [settings, setSettings] = useState<NotificationSettings>(readNotificationSettings);
  const [isSupported] = useState(isNotificationSupported);

  useEffect(() => {
    const syncSettings = () => {
      const stored = readNotificationSettings();
      const permission = getPermissionStatus();
      const next = {
        ...stored,
        permission,
        masterEnabled: permission === 'granted' && stored.masterEnabled,
      };
      setSettings(next);
      if (stored.permission !== next.permission || stored.masterEnabled !== next.masterEnabled) {
        writeNotificationSettings(next);
      }
    };

    syncSettings();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === NOTIFICATION_SETTINGS_KEY) syncSettings();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', syncSettings);
    void registerServiceWorker();

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', syncSettings);
    };
  }, []);

  const updateSettings = useCallback((next: NotificationSettings) => {
    writeNotificationSettings(next);
    setSettings(next);
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!isNotificationSupported()) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.');

    const permission = await requestPermission();
    if (permission !== 'granted') {
      updateSettings({
        ...readNotificationSettings(),
        permission,
        masterEnabled: false,
      });
      return;
    }

    const registration = await registerServiceWorker();
    if (!registration && import.meta.env.PROD) {
      throw new Error('Bildirim servisi kaydedilemedi.');
    }

    const pushSubscription = registration ? await subscribeToPush() : null;
    updateSettings({
      ...readNotificationSettings(),
      permission,
      masterEnabled: true,
      pushSubscription,
    });
  }, [updateSettings]);

  const disableNotifications = useCallback(async () => {
    await unsubscribeFromPush();
    updateSettings({
      ...readNotificationSettings(),
      permission: getPermissionStatus(),
      masterEnabled: false,
      pushSubscription: null,
    });
  }, [updateSettings]);

  const sendTestNotification = useCallback(async () => {
    await showLocalNotification('Tre bildirimi', 'Bildirimler başarıyla çalışıyor.');
  }, []);

  return {
    permission: settings.permission,
    masterEnabled: settings.masterEnabled,
    isSupported,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
  };
}