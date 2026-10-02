// FILE: src/components/NotificationReplyListener.tsx
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  handleNotificationReplyMessage,
  processPendingNotificationReplies,
  retryPendingNotificationReplies,
} from '@/lib/notification-reply-handler';
import { registerServiceWorker } from '@/lib/notification-manager';

export function NotificationReplyListener() {
  useEffect(() => {
    const hasServiceWorker = 'serviceWorker' in navigator;
    if (hasServiceWorker) navigator.serviceWorker.addEventListener('message', handleNotificationReplyMessage);
    const retryQueue = () => retryPendingNotificationReplies();
    window.addEventListener('online', retryQueue);
    window.addEventListener('storage', retryQueue);

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(retryPendingNotificationReplies, 0);
    });

    if (hasServiceWorker) {
      void registerServiceWorker().then((registration) => {
        const worker = navigator.serviceWorker.controller ?? registration?.active;
        worker?.postMessage({ type: 'GET_PENDING_NOTIFICATION_REPLIES' });
      });
    }
    void processPendingNotificationReplies();

    return () => {
      if (hasServiceWorker) navigator.serviceWorker.removeEventListener('message', handleNotificationReplyMessage);
      window.removeEventListener('online', retryQueue);
      window.removeEventListener('storage', retryQueue);
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}