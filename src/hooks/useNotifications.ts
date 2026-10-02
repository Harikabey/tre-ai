// FILE: src/hooks/useNotifications.ts
import { useCallback, useEffect, useState } from 'react';
import {
  getPermissionStatus,
  isNotificationSupported,
  isNotificationReplySupported,
  NOTIFICATION_SETTINGS_KEY,
  readNotificationSettings,
  registerServiceWorker,
  requestPermission,
  showLocalNotification,
  showReplyableNotification,
  onNotificationReply,
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
  replyEnabled: boolean;
  isReplySupported: boolean;
  setReplyEnabled: (enabled: boolean) => void;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
  sendReplyableNotification: (title: string, body: string) => Promise<void>;
}

export function useNotifications(onReply?: (reply: string) => void | Promise<void>): UseNotificationsResult {
  const [settings, setSettings] = useState<NotificationSettings>(readNotificationSettings);
  const [isSupported] = useState(isNotificationSupported);
  const [isReplySupported] = useState(isNotificationReplySupported);

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
    void registerServiceWorker().then(registration => {
      registration?.active?.postMessage({ type: 'SET_REPLY_ENABLED', enabled: readNotificationSettings().replyEnabled });
    });
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

  useEffect(() => {
    if (!onReply) return;
    return onNotificationReply(onReply);
  }, [onReply]);

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

  const sendReplyableNotification = useCallback(async (title: string, body: string) => {
    await showReplyableNotification(title, body);
  }, []);

  const setReplyEnabled = useCallback((enabled: boolean) => {
    updateSettings({ ...readNotificationSettings(), replyEnabled: enabled });
    void registerServiceWorker().then(registration => {
      registration?.active?.postMessage({ type: 'SET_REPLY_ENABLED', enabled });
    });
  }, [updateSettings]);

  return {
    permission: settings.permission,
    masterEnabled: settings.masterEnabled,
    isSupported,
    replyEnabled: settings.replyEnabled,
    isReplySupported,
    setReplyEnabled,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    sendReplyableNotification,
  };
}