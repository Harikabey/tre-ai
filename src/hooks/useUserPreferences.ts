import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  personality: string;
  language: string;
  voice_id: string;
  text_scale: number;
  high_contrast: boolean;
  reduce_motion: boolean;
  screen_share_enabled: boolean;
  swipe_to_delete_enabled: boolean;
}

const DEFAULTS: UserPreferences = {
  theme: 'dark',
  personality: 'friendly',
  language: 'tr',
  voice_id: 'EXAVITQu4vr4xnSDxMaL',
  text_scale: 1,
  high_contrast: false,
  reduce_motion: false,
  screen_share_enabled: false,
  swipe_to_delete_enabled: true,
};

// localStorage keys for fallback / initial load
const LS_KEYS: Record<keyof UserPreferences, string> = {
  theme: 'ai_chatbot_theme',
  personality: 'ai_chatbot_personality',
  language: 'ai_chatbot_language',
  voice_id: 'trefriend_voice_id',
  text_scale: 'ai_chatbot_text_scale',
  high_contrast: 'ai_chatbot_high_contrast',
  reduce_motion: 'ai_chatbot_reduce_motion',
  screen_share_enabled: 'ai_chatbot_screen_share',
};

function loadFromLocalStorage(): Partial<UserPreferences> {
  const result: Partial<UserPreferences> = {};
  const theme = localStorage.getItem(LS_KEYS.theme);
  if (theme) result.theme = theme as UserPreferences['theme'];
  const personality = localStorage.getItem(LS_KEYS.personality);
  if (personality) result.personality = personality;
  const language = localStorage.getItem(LS_KEYS.language);
  if (language) result.language = language;
  const voice = localStorage.getItem(LS_KEYS.voice_id);
  if (voice) result.voice_id = voice;
  const scale = localStorage.getItem(LS_KEYS.text_scale);
  if (scale) result.text_scale = parseFloat(scale);
  result.high_contrast = localStorage.getItem(LS_KEYS.high_contrast) === 'true';
  result.reduce_motion = localStorage.getItem(LS_KEYS.reduce_motion) === 'true';
  result.screen_share_enabled = localStorage.getItem(LS_KEYS.screen_share_enabled) === 'true';
  return result;
}

function syncToLocalStorage(prefs: UserPreferences) {
  localStorage.setItem(LS_KEYS.theme, prefs.theme);
  localStorage.setItem(LS_KEYS.personality, prefs.personality);
  localStorage.setItem(LS_KEYS.language, prefs.language);
  localStorage.setItem(LS_KEYS.voice_id, prefs.voice_id);
  localStorage.setItem(LS_KEYS.text_scale, String(prefs.text_scale));
  localStorage.setItem(LS_KEYS.high_contrast, String(prefs.high_contrast));
  localStorage.setItem(LS_KEYS.reduce_motion, String(prefs.reduce_motion));
  localStorage.setItem(LS_KEYS.screen_share_enabled, String(prefs.screen_share_enabled));
}

export const useUserPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(() => ({
    ...DEFAULTS,
    ...loadFromLocalStorage(),
  }));
  const [loaded, setLoaded] = useState(false);

  // Load from DB when user logs in
  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        const dbPrefs: UserPreferences = {
          theme: (data.theme as UserPreferences['theme']) || DEFAULTS.theme,
          personality: data.personality || DEFAULTS.personality,
          language: data.language || DEFAULTS.language,
          voice_id: data.voice_id || DEFAULTS.voice_id,
          text_scale: Number(data.text_scale) || DEFAULTS.text_scale,
          high_contrast: data.high_contrast ?? DEFAULTS.high_contrast,
          reduce_motion: data.reduce_motion ?? DEFAULTS.reduce_motion,
          screen_share_enabled: data.screen_share_enabled ?? DEFAULTS.screen_share_enabled,
        };
        setPreferences(dbPrefs);
        syncToLocalStorage(dbPrefs);
        applyPreferences(dbPrefs);
      } else if (!error && !data) {
        // No record yet — create one from localStorage values
        const localPrefs = { ...DEFAULTS, ...loadFromLocalStorage() };
        await supabase.from('user_preferences').insert({
          user_id: user.id,
          ...localPrefs,
        });
        setPreferences(localPrefs);
        applyPreferences(localPrefs);
      }
      setLoaded(true);
    };

    load();
  }, [user]);

  const applyPreferences = useCallback((prefs: UserPreferences) => {
    // Theme
    const root = document.documentElement;
    let effectiveTheme: 'light' | 'dark';
    if (prefs.theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effectiveTheme = prefs.theme;
    }
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);

    // Text scale
    root.style.fontSize = `${prefs.text_scale * 16}px`;

    // Accessibility
    root.classList.toggle('high-contrast', prefs.high_contrast);
    root.classList.toggle('reduce-motion', prefs.reduce_motion);
  }, []);

  const updatePreference = useCallback(async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      syncToLocalStorage(updated);
      applyPreferences(updated);
      return updated;
    });

    if (user) {
      await supabase
        .from('user_preferences')
        .update({ [key]: value } as any)
        .eq('user_id', user.id);
    }
  }, [user, applyPreferences]);

  return {
    preferences,
    loaded,
    updatePreference,
  };
};
