// FILE: src/lib/notification-reply-handler.ts
import { supabase } from '@/integrations/supabase/client';
import { showReplyableNotification } from '@/lib/notification-manager';

const PENDING_REPLIES_KEY = 'tre_pending_notification_replies';
const COMPLETED_REPLIES_KEY = 'tre_completed_notification_replies';

interface PendingNotificationReply {
  replyId: string;
  text: string;
  conversationId: string | null;
  failureNotified: boolean;
}

interface ReplyMessage {
  type?: unknown;
  replyId?: unknown;
  text?: unknown;
  reply?: unknown;
  conversationId?: unknown;
  replies?: unknown;
}

interface ReplyResponse {
  ok: boolean;
  conversationId: string | null;
  reply: string;
}

function readStoredReplies(): PendingNotificationReply[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(PENDING_REPLIES_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is PendingNotificationReply =>
      !!item && typeof item === 'object' &&
      typeof item.replyId === 'string' && typeof item.text === 'string' &&
      (typeof item.conversationId === 'string' || item.conversationId === null) &&
      typeof item.failureNotified === 'boolean'
    );
  } catch {
    return [];
  }
}

let pendingReplies = readStoredReplies();
let processingReplies = false;
let retryTimer: number | null = null;

function scheduleQueueRetry(): void {
  if (retryTimer !== null) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    retryPendingNotificationReplies();
  }, 30000);
}

function persistPendingReplies(): boolean {
  try {
    window.localStorage.setItem(PENDING_REPLIES_KEY, JSON.stringify(pendingReplies));
    return true;
  } catch (error) {
    console.error('Bildirim yanıt kuyruğu kaydedilemedi.', error);
    return false;
  }
}

function readCompletedReplyIds(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(COMPLETED_REPLIES_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function acknowledgeReply(source: MessageEventSource | null, replyId: string): void {
  source?.postMessage({ type: 'NOTIFICATION_REPLY_ACK', replyId });
}

function addReply(reply: PendingNotificationReply, source: MessageEventSource | null): void {
  const completedReplyIds = readCompletedReplyIds();
  if (completedReplyIds.includes(reply.replyId)) {
    acknowledgeReply(source, reply.replyId);
    return;
  }

  if (!pendingReplies.some((pending) => pending.replyId === reply.replyId)) {
    pendingReplies = [...pendingReplies, reply];
  }
  if (persistPendingReplies()) acknowledgeReply(source, reply.replyId);
  void processPendingNotificationReplies();
}

function parseReply(value: unknown): PendingNotificationReply | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as ReplyMessage;
  const isLegacyReply = message.type === 'NOTIFICATION_REPLY';
  const text = isLegacyReply ? message.reply : message.text;
  if ((message.type !== 'notification-reply' && !isLegacyReply) || typeof text !== 'string') return null;

  const conversationId = typeof message.conversationId === 'string' ? message.conversationId : null;
  const replyId = typeof message.replyId === 'string'
    ? message.replyId
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { replyId, text: text.trim().slice(0, 500), conversationId, failureNotified: false };
}

export function handleNotificationReplyMessage(event: MessageEvent<unknown>): void {
  const message = event.data as ReplyMessage | null;
  if (message?.type === 'PENDING_NOTIFICATION_REPLIES' && Array.isArray(message.replies)) {
    for (const item of message.replies) {
      const reply = parseReply({ ...(item as object), type: 'notification-reply' });
      if (reply) addReply(reply, event.source);
    }
    return;
  }

  const reply = parseReply(message);
  if (reply) addReply(reply, event.source);
}

export async function processPendingNotificationReplies(): Promise<void> {
  if (processingReplies || !navigator.onLine) return;
  processingReplies = true;

  try {
    while (pendingReplies.length > 0 && navigator.onLine) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const pending = pendingReplies[0];
      const { data, error } = await supabase.functions.invoke<ReplyResponse>('reply-to-tre', {
        body: {
          message: pending.text,
          conversationId: pending.conversationId,
          sendPush: false,
        },
      });

      if (error || !data?.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
        if (!pending.failureNotified) {
          await showReplyableNotification('Tre', 'Tre şu an yanıt veremiyor.', pending.conversationId ?? undefined)
            .catch((notificationError: unknown) => console.warn('Yanıt bildirimi gösterilemedi.', notificationError));
          pendingReplies[0] = { ...pending, failureNotified: true };
          persistPendingReplies();
        }
        scheduleQueueRetry();
        return;
      }

      await showReplyableNotification('Tre', data.reply.slice(0, 500), data.conversationId ?? pending.conversationId ?? undefined)
        .catch((notificationError: unknown) => console.warn('Tre yanıt bildirimi gösterilemedi.', notificationError));

      pendingReplies = pendingReplies.filter((reply) => reply.replyId !== pending.replyId);
      persistPendingReplies();
      const completedReplyIds = [...readCompletedReplyIds(), pending.replyId].slice(-100);
      try {
        window.localStorage.setItem(COMPLETED_REPLIES_KEY, JSON.stringify(completedReplyIds));
      } catch (storageError) {
        console.warn('Tamamlanan bildirim yanıtı kaydedilemedi.', storageError);
      }
    }
  } catch (error) {
    console.error('Bildirim yanıt kuyruğu işlenemedi.', error);
    scheduleQueueRetry();
  } finally {
    processingReplies = false;
  }
}

export function retryPendingNotificationReplies(): void {
  pendingReplies = readStoredReplies();
  void processPendingNotificationReplies();
}