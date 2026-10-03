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
import { getLocalDateKey } from '@/lib/stats-utils';
import {
  readSupportiveNotificationSettings,
  useSupportiveNotifications,
  type SupportiveNotificationType,
} from '@/hooks/useSupportiveNotifications';

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
  checkMissYou: () => Promise<void>;
  checkStreak: () => Promise<void>;
  checkJourney: () => Promise<void>;
  checkSocialProof: () => Promise<void>;
  checkCuriosity: () => Promise<void>;
  checkEasterEgg: () => Promise<void>;
  checkSupportiveNotifications: () => Promise<void>;
}

interface SupportiveNotificationHistory {
  date: string;
  sentTypes: SupportiveNotificationType[];
  journeyMilestone: number;
}

interface SupportiveStatsSnapshot {
  totalUserMessages: number;
  lastMessageDate: string;
  dailyActivity: Record<string, number>;
}

const SUPPORTIVE_NOTIFICATION_HISTORY_KEY = 'tre_supportive_notification_history';
const SUPPORTIVE_STATS_KEY = 'tre_stats_data';
const STREAK_DATA_KEY = 'tre_streak_data';
const supportiveTypes: SupportiveNotificationType[] = [
  'streakReminder',
  'missYou',
  'journey',
  'socialProof',
  'curiosity',
  'easterEgg',
];

function emptyHistory(date = getLocalDateKey()): SupportiveNotificationHistory {
  return { date, sentTypes: [], journeyMilestone: 0 };
}

function readSupportiveHistory(): SupportiveNotificationHistory {
  try {
    const raw = window.localStorage.getItem(SUPPORTIVE_NOTIFICATION_HISTORY_KEY);
    if (!raw) return emptyHistory();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyHistory();
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.date !== 'string' ||
      !Array.isArray(value.sentTypes) ||
      typeof value.journeyMilestone !== 'number' ||
      !Number.isFinite(value.journeyMilestone)
    ) return emptyHistory();

    const previous = {
      date: value.date,
      sentTypes: value.sentTypes.filter(
        (type): type is SupportiveNotificationType =>
          typeof type === 'string' && supportiveTypes.includes(type as SupportiveNotificationType),
      ),
      journeyMilestone: Math.max(0, Math.floor(value.journeyMilestone)),
    };
    if (previous.date === getLocalDateKey()) return previous;
    return { ...emptyHistory(), journeyMilestone: previous.journeyMilestone };
  } catch (error) {
    console.warn('Destekleyici bildirim geçmişi okunamadı.', error);
    return emptyHistory();
  }
}

function writeSupportiveHistory(history: SupportiveNotificationHistory): void {
  try {
    window.localStorage.setItem(SUPPORTIVE_NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Destekleyici bildirim geçmişi kaydedilemedi.', error);
  }
}

function readSupportiveStats(): SupportiveStatsSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SUPPORTIVE_STATS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    const dailyActivity = value.dailyActivity;
    if (
      typeof value.totalUserMessages !== 'number' ||
      !Number.isFinite(value.totalUserMessages) ||
      typeof value.lastMessageDate !== 'string' ||
      !dailyActivity ||
      typeof dailyActivity !== 'object' ||
      Array.isArray(dailyActivity)
    ) return null;
    return {
      totalUserMessages: Math.max(0, value.totalUserMessages),
      lastMessageDate: value.lastMessageDate,
      dailyActivity: dailyActivity as Record<string, number>,
    };
  } catch (error) {
    console.warn('İstatistikler okunamadı; destekleyici bildirimler atlandı.', error);
    return null;
  }
}

function dayOffset(dateKey: string, todayKey: string): number {
  const date = new Date(`${dateKey}T12:00:00`);
  const today = new Date(`${todayKey}T12:00:00`);
  if (Number.isNaN(date.getTime()) || Number.isNaN(today.getTime())) return Number.NaN;
  return Math.round((today.getTime() - date.getTime()) / 86_400_000);
}

function isQuietHours(settings: ReturnType<typeof readSupportiveNotificationSettings>, now: Date): boolean {
  if (!settings.quietHoursEnabled) return false;
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(settings.quietHoursStart);
  const end = toMinutes(settings.quietHoursEnd);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

export function useNotifications(onReply?: (reply: string) => void | Promise<void>): UseNotificationsResult {
  const [settings, setSettings] = useState<NotificationSettings>(readNotificationSettings);
  const { isEnabled } = useSupportiveNotifications();
  const [isSupported] = useState(isNotificationSupported);
  const [isReplySupported] = useState(isNotificationReplySupported);
  const [remindersEnabled, setRemindersEnabledState] = useState(areReminderNotificationsEnabled);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const checkingReminders = useRef(false);
  const checkingSupportive = useRef(false);

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

  const sendSupportiveNotification = useCallback(async (
    type: SupportiveNotificationType,
    body: string,
    journeyMilestone?: number,
  ): Promise<boolean> => {
    const supportiveSettings = readSupportiveNotificationSettings();
    if (
      !isEnabled(type) ||
      !supportiveSettings.masterEnabled ||
      !supportiveSettings[type] ||
      !readNotificationSettings().masterEnabled ||
      getPermissionStatus() !== 'granted' ||
      isQuietHours(supportiveSettings, new Date())
    ) return false;

    const history = readSupportiveHistory();
    if (
      history.sentTypes.includes(type) ||
      history.sentTypes.length >= supportiveSettings.dailyLimit
    ) return false;

    try {
      await showLocalNotification('Tre', body, {
        tag: `tre-supportive-${type}-${history.date}`,
        data: { url: '/' },
      });
    } catch (error) {
      console.error(`Destekleyici bildirim gönderilemedi (${type}).`, error);
      return false;
    }

    const nextHistory: SupportiveNotificationHistory = {
      ...history,
      sentTypes: [...history.sentTypes, type],
      journeyMilestone: journeyMilestone === undefined
        ? history.journeyMilestone
        : Math.max(history.journeyMilestone, journeyMilestone),
    };
    writeSupportiveHistory(nextHistory);
    return true;
  }, [isEnabled]);

  const checkMissYou = useCallback(async () => {
    const stats = readSupportiveStats();
    if (!stats?.lastMessageDate) return;
    if (dayOffset(stats.lastMessageDate, getLocalDateKey()) < 2) return;
    await sendSupportiveNotification('missYou', 'Seni özledim. Bugün konuşalım mı? ☕');
  }, [sendSupportiveNotification]);

  const checkStreak = useCallback(async () => {
    const now = new Date();
    if (now.getHours() < 19) return;
    const stats = readSupportiveStats();
    if (stats?.dailyActivity[getLocalDateKey()]) return;

    try {
      const raw = window.localStorage.getItem(STREAK_DATA_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const streak = parsed as Record<string, unknown>;
      if (typeof streak.currentStreak !== 'number' || streak.currentStreak < 1) return;
      await sendSupportiveNotification(
        'streakReminder',
        `🔥 ${Math.floor(streak.currentStreak)} günlük serin var! Bugün de devam edelim mi? 🧊 Dondurman seni bekliyor.`,
      );
    } catch (error) {
      console.warn('Seri bilgisi okunamadı; seri bildirimi atlandı.', error);
    }
  }, [sendSupportiveNotification]);

  const checkJourney = useCallback(async () => {
    const stats = readSupportiveStats();
    if (!stats || stats.totalUserMessages < 25) return;
    const milestone = Math.floor(stats.totalUserMessages / 25) * 25;
    const history = readSupportiveHistory();
    if (milestone <= history.journeyMilestone) return;
    await sendSupportiveNotification(
      'journey',
      `${stats.totalUserMessages} mesajlık bir yolculuk. Devam edelim mi? 🚀`,
      milestone,
    );
  }, [sendSupportiveNotification]);

  const checkSocialProof = useCallback(async () => {
    const now = new Date();
    if (now.getDay() !== 1 || now.getHours() < 9 || now.getHours() >= 21) return;
    const stats = readSupportiveStats();
    if (!stats) return;
    const today = getLocalDateKey();
    let thisWeek = 0;
    let lastWeek = 0;
    Object.entries(stats.dailyActivity).forEach(([date, count]) => {
      if (typeof count !== 'number' || !Number.isFinite(count)) return;
      const offset = dayOffset(date, today);
      if (offset >= 0 && offset < 7) thisWeek += count;
      else if (offset >= 7 && offset < 14) lastWeek += count;
    });
    if (thisWeek === 0 && lastWeek === 0) return;
    await sendSupportiveNotification(
      'socialProof',
      `Bu hafta ${thisWeek} mesaj attın (geçen hafta ${lastWeek}). Artırmak ister misin?`,
    );
  }, [sendSupportiveNotification]);

  const checkCuriosity = useCallback(async () => {
    const now = new Date();
    if (now.getHours() < 9 || now.getHours() >= 21) return;
    const stats = readSupportiveStats();
    if (!stats || stats.totalUserMessages < 1) return;
    const rawTopicCounts = (() => {
      try {
        const raw = window.localStorage.getItem(SUPPORTIVE_STATS_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const topicCounts = (parsed as Record<string, unknown>).topicCounts;
        return topicCounts && typeof topicCounts === 'object' && !Array.isArray(topicCounts)
          ? topicCounts as Record<string, number>
          : null;
      } catch (error) {
        console.warn('Konu istatistikleri okunamadı; genel merak konusu kullanılacak.', error);
        return null;
      }
    })();
    const topTopic = rawTopicCounts
      ? Object.entries(rawTopicCounts)
        .filter((entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0)
        .sort((first, second) => second[1] - first[1])[0]?.[0]
      : undefined;
    const topicLabels: Record<string, string> = {
      kod: 'kodlamayı',
      ödev: 'öğrenmeyi',
      duygu: 'duygularını',
      plan: 'planlarını',
      arama: 'keşfetmeyi',
      sohbet: 'sohbet etmeyi',
    };
    const topic = topTopic ? topicLabels[topTopic] ?? topTopic : 'yeni fikirleri';
    await sendSupportiveNotification('curiosity', `Merhaba! Bugün '${topic}' konusunu merak ettim. Konuşmak ister misin?`);
  }, [sendSupportiveNotification]);

  const checkEasterEgg = useCallback(async () => {
    await sendSupportiveNotification(
      'easterEgg',
      '🎉 Bravo! Gizli bir Easter Egg buldun. Sen gerçek bir Tre uzmanısın!',
    );
  }, [sendSupportiveNotification]);

  const checkSupportiveNotifications = useCallback(async () => {
    if (checkingSupportive.current) return;
    checkingSupportive.current = true;
    try {
      await checkMissYou();
      await checkStreak();
      await checkJourney();
      await checkSocialProof();
      await checkCuriosity();
    } finally {
      checkingSupportive.current = false;
    }
  }, [checkMissYou, checkStreak, checkJourney, checkSocialProof, checkCuriosity]);

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
    checkMissYou,
    checkStreak,
    checkJourney,
    checkSocialProof,
    checkCuriosity,
    checkEasterEgg,
    checkSupportiveNotifications,
  };
}