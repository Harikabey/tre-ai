// FILE: src/lib/notification-manager.ts
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';

export const NOTIFICATION_SETTINGS_KEY = 'tre_notification_settings';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface NotificationSettings {
  permission: NotificationPermission;
  masterEnabled: boolean;
  replyEnabled: boolean;
  pushSubscription: PushSubscriptionJSON | null;
  lastPermissionRequest: number;
}

const permissionValues: NotificationPermission[] = ['default', 'granted', 'denied'];
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
const handledNotificationReplies = new Set<string>();

function browserPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'default';
  const permission = Notification.permission;
  return permissionValues.includes(permission as NotificationPermission)
    ? permission as NotificationPermission
    : 'default';
}

export function getDefaultNotificationSettings(): NotificationSettings {
  return {
    permission: browserPermission(),
    masterEnabled: false,
    replyEnabled: false,
    pushSubscription: null,
    lastPermissionRequest: 0,
  };
}

export function readNotificationSettings(): NotificationSettings {
  const defaults = getDefaultNotificationSettings();
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return defaults;

    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return defaults;
    const parsed = value as Partial<NotificationSettings>;
    const validSubscription = parsed.pushSubscription === null ||
      (typeof parsed.pushSubscription === 'object' && !Array.isArray(parsed.pushSubscription));

    if (
      !permissionValues.includes(parsed.permission as NotificationPermission) ||
      typeof parsed.masterEnabled !== 'boolean' ||
      (parsed.replyEnabled !== undefined && typeof parsed.replyEnabled !== 'boolean') ||
      !validSubscription ||
      typeof parsed.lastPermissionRequest !== 'number' ||
      !Number.isFinite(parsed.lastPermissionRequest)
    ) return defaults;

    return {
      permission: parsed.permission as NotificationPermission,
      masterEnabled: parsed.masterEnabled,
      replyEnabled: parsed.replyEnabled ?? false,
      pushSubscription: parsed.pushSubscription as PushSubscriptionJSON | null,
      lastPermissionRequest: parsed.lastPermissionRequest,
    };
  } catch {
    return defaults;
  }
}

export function writeNotificationSettings(settings: NotificationSettings): void {
  try {
    window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Bildirim ayarları kaydedilemedi.', error);
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isNotificationReplySupported(): boolean {
  if (!isNotificationSupported() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const userAgent = navigator.userAgent;
  const isChromeOrEdge = /Chrome|Chromium|Edg\//.test(userAgent) && !/Firefox|OPR\//.test(userAgent);
  const isIOS = /iPad|iPhone|iPod|CriOS|FxiOS/.test(userAgent);
  const notificationConstructor = Notification as typeof Notification & { readonly maxActions?: number };
  return isChromeOrEdge && !isIOS && (notificationConstructor.maxActions ?? 0) > 0;
}

export function onNotificationReply(callback: (reply: string) => void | Promise<void>): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const handleMessage = (event: MessageEvent<unknown>) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    const data = message as { type?: unknown; reply?: unknown; replyId?: unknown };
    if (data.type !== 'NOTIFICATION_REPLY' || typeof data.reply !== 'string' || typeof data.replyId !== 'string') return;

    event.source?.postMessage({ type: 'NOTIFICATION_REPLY_ACK', replyId: data.replyId });
    if (handledNotificationReplies.has(data.replyId)) return;
    handledNotificationReplies.add(data.replyId);
    void Promise.resolve(callback(data.reply.slice(0, 500))).catch((error: unknown) => {
      console.error('Bildirim yanıtı işlenemedi.', error);
    });
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);
  return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
}

export function getPermissionStatus(): NotificationPermission {
  return browserPermission();
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'default';

  const permission = await Notification.requestPermission();
  const settings = readNotificationSettings();
  writeNotificationSettings({
    ...settings,
    permission: permissionValues.includes(permission as NotificationPermission)
      ? permission as NotificationPermission
      : 'default',
    lastPermissionRequest: Date.now(),
  });
  return getPermissionStatus();
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (
    !import.meta.env.PROD ||
    typeof navigator === 'undefined' ||
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '')
  ) return Promise.resolve(null);

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }).catch((error: unknown) => {
      console.warn('Service Worker kaydedilemedi.', error);
      return null;
    });
  }
  return registrationPromise;
}

export async function subscribeToPush(): Promise<PushSubscriptionJSON> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Bu tarayıcı push bildirimlerini desteklemiyor.');
  }
  if (!isSupabaseConfigured) {
    throw new Error('Push bildirimleri için Tre hesabına bağlanılamıyor.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Push bildirimlerini etkinleştirmek için Tre hesabına giriş yapmalısın.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { data, error } = await supabase.functions.invoke<{ publicKey: string }>('get-vapid-public-key');
    if (error || !data?.publicKey) {
      throw new Error(error?.message || 'Push bildirim anahtarı alınamadı.');
    }
    const base64Key = data.publicKey.replace(/-/g, '+').replace(/_/g, '/');
    const paddedKey = base64Key.padEnd(Math.ceil(base64Key.length / 4) * 4, '=');
    const binaryKey = window.atob(paddedKey);
    const applicationServerKey = Uint8Array.from(binaryKey, (character) => character.charCodeAt(0));
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error('Push abonelik bilgileri eksik.');
  }

  const { error: registrationError } = await supabase.functions.invoke('register-push-subscription', {
    body: {
      endpoint: serialized.endpoint,
      keys: serialized.keys,
      userAgent: navigator.userAgent,
    },
  });
  if (registrationError) {
    throw new Error(registrationError.message || 'Push aboneliği kaydedilemedi.');
  }

  const settings = readNotificationSettings();
  writeNotificationSettings({ ...settings, pushSubscription: serialized });
  return serialized;
}

export async function unsubscribeFromPush(): Promise<void> {
  let endpoint: string | null = null;
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    endpoint = subscription?.endpoint ?? null;
    await subscription?.unsubscribe();
  }

  if (endpoint && isSupabaseConfigured) {
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) console.warn('Push aboneliği sunucudan kaldırılamadı.', error);
  }

  const settings = readNotificationSettings();
  writeNotificationSettings({ ...settings, pushSubscription: null, masterEnabled: false });
}

export async function showLocalNotification(
  title: string,
  body: string,
  options: NotificationOptions = {},
): Promise<void> {
  if (!isNotificationSupported() || getPermissionStatus() !== 'granted') {
    throw new Error('Bildirim göndermek için tarayıcı izni gerekiyor.');
  }

  const registration = await registerServiceWorker() ?? (
    'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration('/')
      : undefined
  );
  if (registration) {
    await registration.showNotification(title, { ...options, body });
    return;
  }

  if (!import.meta.env.PROD) {
    new Notification(title, { ...options, body });
    return;
  }
  throw new Error('Bildirim servisi henüz hazır değil.');
}

export async function showReplyableNotification(title: string, body: string): Promise<void> {
  if (!isNotificationSupported() || getPermissionStatus() !== 'granted') {
    throw new Error('Bildirim göndermek için tarayıcı izni gerekiyor.');
  }

  const registration = await registerServiceWorker() ?? (
    'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration('/')
      : undefined
  );
  if (!registration?.active || !isNotificationReplySupported()) {
    await showLocalNotification(title, body);
    return;
  }

  registration.active.postMessage({
    type: 'SHOW_REPLYABLE_NOTIFICATION',
    title,
    body,
    options: { icon: '/icon-192.png', badge: '/icon-192.png' },
  });
}