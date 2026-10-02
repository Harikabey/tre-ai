// FILE: src/hooks/useNotifications.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  areReminderNotificationsEnabled,
  readReminders,
  REMINDER_NOTIFICATIONS_ENABLED_KEY,
  REMINDERS_STORAGE_KEY,
  REMINDERS_CHANGED_EVENT,
  writeReminders,
  type Reminder,
} from '@/lib/reminders';
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
  sendReplyableNotification: (title: string, body: string, conversationId?: string) => Promise<void>;
  remindersEnabled: boolean;
  reminders: Reminder[];
  setRemindersEnabled: (enabled: boolean) => void;
  checkReminders: (onStartup?: boolean) => Promise<void>;
}

export function useNotifications(onReply?: (reply: string) => void | Promise<void>): UseNotificationsResult {
  const [settings, setSettings] = useState<NotificationSettings>(readNotificationSettings);
  const [isSupported] = useState(isNotificationSupported);
  const [isReplySupported] = useState(isNotificationReplySupported);
  const [remindersEnabled, setRemindersEnabledState] = useState(areReminderNotificationsEnabled);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const checkingReminders = useRef(false);

  const refreshReminders = useCallback(() => {
    try {
      setReminders(readReminders());
    } catch (error) {
      console.error('Hatırlatıcılar okunamadı.', error);
    }
  }, []);

  useEffect(() => {
    refreshReminders();
    const syncReminderSetting = () => setRemindersEnabledState(areReminderNotificationsEnabled());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === REMINDER_NOTIFICATIONS_ENABLED_KEY) syncReminderSetting();
      if (event.key === REMINDERS_STORAGE_KEY) refreshReminders();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(REMINDERS_CHANGED_EVENT, refreshReminders);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(REMINDERS_CHANGED_EVENT, refreshReminders);
    };
  }, [refreshReminders]);

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
    const title = 'Tre bildirimi';
    const body = 'Bildirimler başarıyla çalışıyor.';
    if (readNotificationSettings().replyEnabled) {
      await showReplyableNotification(title, body);
      return;
    }
    await showLocalNotification(title, body);
  }, []);

  const sendReplyableNotification = useCallback(async (title: string, body: string, conversationId?: string) => {
    await showReplyableNotification(title, body, conversationId);
  }, []);

  const setReplyEnabled = useCallback((enabled: boolean) => {
    updateSettings({ ...readNotificationSettings(), replyEnabled: enabled });
    void registerServiceWorker().then(registration => {
      registration?.active?.postMessage({ type: 'SET_REPLY_ENABLED', enabled });
    });
  }, [updateSettings]);

  const setRemindersEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(REMINDER_NOTIFICATIONS_ENABLED_KEY, String(enabled));
    setRemindersEnabledState(enabled);
  }, []);

  const checkReminders = useCallback(async (onStartup = false) => {
    if (checkingReminders.current) return;
    checkingReminders.current = true;
    try {
      const now = Date.now();
      let pending = readReminders();
      if (onStartup) {
        const updated = pending.map((reminder) =>
          !reminder.notified && Date.parse(reminder.dueAt) <= now && !reminder.missed
            ? { ...reminder, missed: true }
            : reminder,
        );
        if (updated.some((reminder, index) => reminder !== pending[index])) {
          writeReminders(updated);
          pending = updated;
        }
      }

      if (
        !areReminderNotificationsEnabled() ||
        !readNotificationSettings().masterEnabled ||
        getPermissionStatus() !== 'granted'
      ) return;

      for (const reminder of pending) {
        if (reminder.notified || Date.parse(reminder.dueAt) > now) continue;
        const body = reminder.text.length > 180
          ? `${reminder.text.slice(0, 177)}...`
          : reminder.text;
        try {
          await showLocalNotification('⏰ Tre hatırlatıcısı', body, {
            tag: `tre-reminder-${reminder.id}`,
            data: {
              url: `/settings?reminderId=${encodeURIComponent(reminder.id)}`,
              reminderId: reminder.id,
            },
          });
          const current = readReminders();
          writeReminders(current.map((item) =>
            item.id === reminder.id ? { ...item, notified: true } : item,
          ));
        } catch (error) {
          console.error(`Hatırlatıcı bildirimi gönderilemedi (${reminder.id}).`, error);
        }
      }
    } catch (error) {
      console.error('Hatırlatıcılar kontrol edilemedi.', error);
    } finally {
      checkingReminders.current = false;
      refreshReminders();
    }
  }, [refreshReminders]);

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
    remindersEnabled,
    reminders,
    setRemindersEnabled,
    checkReminders,
  };
}