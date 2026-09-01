import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Local (client-side) scheduler:
 *  1. Morning / evening notifications at user-defined local times
 *  2. Inactivity notification (no chat for 2 days)
 *  3. Auto-clean: delete conversations untouched for 30 days
 *
 * All settings live in localStorage. No DB schema change.
 */

export interface SchedulerSettings {
  dailyEnabled: boolean;
  morningTime: string; // "HH:MM"
  eveningTime: string;
  morningText: string;
  eveningText: string;
  inactivityEnabled: boolean;
  autoCleanEnabled: boolean;
}

export const SCHEDULER_DEFAULTS: SchedulerSettings = {
  dailyEnabled: false,
  morningTime: '08:00',
  eveningTime: '21:00',
  morningText: 'Günaydın! Bugün ne yapmak istersin?',
  eveningText: 'İyi akşamlar! Günün nasıl geçti, anlatmak ister misin?',
  inactivityEnabled: false,
  autoCleanEnabled: false,
};

const LS_KEY = 'tre_scheduler_settings';
const LS_MARKS = 'tre_scheduler_marks'; // last-fired markers

type Marks = Record<string, string>;

export function loadSchedulerSettings(): SchedulerSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...SCHEDULER_DEFAULTS, ...JSON.parse(raw) } : { ...SCHEDULER_DEFAULTS };
  } catch {
    return { ...SCHEDULER_DEFAULTS };
  }
}

export function saveSchedulerSettings(s: SchedulerSettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function loadMarks(): Marks {
  try {
    return JSON.parse(localStorage.getItem(LS_MARKS) || '{}');
  } catch {
    return {};
  }
}

function setMark(key: string, value: string) {
  const marks = loadMarks();
  marks[key] = value;
  localStorage.setItem(LS_MARKS, JSON.stringify(marks));
}

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function minutesOfDay(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function parseTime(t: string) {
  const [h, m] = (t || '00:00').split(':').map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

async function notify(title: string, body: string, tag: string, url = '/') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const options: NotificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    data: { url },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, options);
  } catch {
    /* ignore */
  }
}

export function useLocalScheduler() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SchedulerSettings>(() => loadSchedulerSettings());
  const running = useRef(false);

  const update = useCallback(<K extends keyof SchedulerSettings>(key: K, value: SchedulerSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSchedulerSettings(next);
      return next;
    });
  }, []);

  const tick = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const s = loadSchedulerSettings();
      const marks = loadMarks();
      const today = localDayKey();
      const now = minutesOfDay();

      // 1) Morning / evening
      if (s.dailyEnabled) {
        const slots: Array<['morning' | 'evening', number, string]> = [
          ['morning', parseTime(s.morningTime), s.morningText || SCHEDULER_DEFAULTS.morningText],
          ['evening', parseTime(s.eveningTime), s.eveningText || SCHEDULER_DEFAULTS.eveningText],
        ];
        for (const [slot, at, text] of slots) {
          const markKey = `daily_${slot}`;
          // fire within a 30-minute window after the scheduled time, once per local day
          if (now >= at && now - at <= 30 && marks[markKey] !== today) {
            setMark(markKey, today);
            await notify('Tre', text, `tre-daily-${slot}`, '/');
          }
        }
      }

      if (!user) return;

      // 2) Inactivity (no chat activity for 2+ days)
      if (s.inactivityEnabled && marks['inactivity'] !== today) {
        const { data } = await supabase
          .from('conversations')
          .select('updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const last = data?.updated_at ? new Date(data.updated_at).getTime() : null;
        if (last && Date.now() - last >= 2 * 24 * 60 * 60 * 1000) {
          setMark('inactivity', today);
          await notify('Tre', 'Bir şey mi oldu? Uzun zamandır konuşmuyoruz, seni özledim.', 'tre-inactivity', '/');
        }
      }

      // 3) Auto-clean: delete conversations untouched for 30+ days (memory & prefs kept)
      if (s.autoCleanEnabled && marks['autoclean'] !== today) {
        setMark('autoclean', today);
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('conversations')
          .delete()
          .eq('user_id', user.id)
          .lt('updated_at', cutoff);
      }
    } catch (e) {
      console.warn('[scheduler] tick failed', e);
    } finally {
      running.current = false;
    }
  }, [user]);

  useEffect(() => {
    tick();
    const id = window.setInterval(tick, 5 * 60 * 1000); // every 5 minutes
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tick]);

  return { settings, update, runNow: tick };
}
