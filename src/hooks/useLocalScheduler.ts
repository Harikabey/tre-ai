import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Local (client-side) scheduler:
 *  Automatically deletes conversations untouched for 30 days.
 *
 * All settings live in localStorage. No DB schema change.
 */

export interface SchedulerSettings {
  autoCleanEnabled: boolean;
}

export const SCHEDULER_DEFAULTS: SchedulerSettings = {
  autoCleanEnabled: false,
};

const LS_KEY = 'tre_scheduler_settings';
const LS_MARKS = 'tre_scheduler_marks'; // last-fired markers

type Marks = Record<string, string>;

export function loadSchedulerSettings(): SchedulerSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw
      ? { autoCleanEnabled: JSON.parse(raw).autoCleanEnabled === true }
      : { ...SCHEDULER_DEFAULTS };
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

      if (!user) return;

      // Auto-clean conversations untouched for 30+ days; memory and preferences are kept.
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
