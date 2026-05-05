import { useState, useEffect, useCallback } from 'react';

export type AccentColor = 'cyan' | 'purple' | 'emerald' | 'rose' | 'amber' | 'blue';
export type FontFamily = 'outfit' | 'inter' | 'mono' | 'serif';
export type BubbleStyle = 'rounded' | 'square' | 'minimal';
export type Wallpaper = 'none' | 'aurora' | 'mesh' | 'dots' | 'sunset';

export interface UICustomization {
  accent: AccentColor;
  font: FontFamily;
  bubble: BubbleStyle;
  wallpaper: Wallpaper;
}

const DEFAULTS: UICustomization = {
  accent: 'cyan',
  font: 'outfit',
  bubble: 'rounded',
  wallpaper: 'none',
};

const KEY = 'ai_chatbot_ui_customization';

// Accent → HSL primary value
export const ACCENT_HSL: Record<AccentColor, { primary: string; ring: string; glow: string }> = {
  cyan: { primary: '180 100% 50%', ring: '180 100% 50%', glow: '180 100% 50%' },
  purple: { primary: '270 90% 65%', ring: '270 90% 65%', glow: '270 90% 65%' },
  emerald: { primary: '160 84% 45%', ring: '160 84% 45%', glow: '160 84% 45%' },
  rose: { primary: '345 90% 60%', ring: '345 90% 60%', glow: '345 90% 60%' },
  amber: { primary: '40 95% 55%', ring: '40 95% 55%', glow: '40 95% 55%' },
  blue: { primary: '215 95% 60%', ring: '215 95% 60%', glow: '215 95% 60%' },
};

export const ACCENT_LABELS: Record<AccentColor, string> = {
  cyan: 'Cyan',
  purple: 'Mor',
  emerald: 'Zümrüt',
  rose: 'Gül',
  amber: 'Amber',
  blue: 'Mavi',
};

export const FONT_LABELS: Record<FontFamily, string> = {
  outfit: 'Outfit (Modern)',
  inter: 'Inter (Sade)',
  mono: 'JetBrains Mono',
  serif: 'Serif (Klasik)',
};

export const BUBBLE_LABELS: Record<BubbleStyle, string> = {
  rounded: 'Yuvarlak',
  square: 'Köşeli',
  minimal: 'Minimal',
};

export const WALLPAPER_LABELS: Record<Wallpaper, string> = {
  none: 'Yok',
  aurora: 'Aurora',
  mesh: 'Mesh',
  dots: 'Noktalar',
  sunset: 'Gün Batımı',
};

function load(): UICustomization {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

export function applyUICustomization(prefs: UICustomization) {
  const root = document.documentElement;
  // Accent color via CSS variable override
  const a = ACCENT_HSL[prefs.accent];
  root.style.setProperty('--primary', a.primary);
  root.style.setProperty('--ring', a.ring);
  root.style.setProperty('--sidebar-primary', a.primary);
  root.style.setProperty('--sidebar-ring', a.ring);
  root.style.setProperty('--glow-primary', `0 0 20px hsl(${a.glow} / 0.4)`);
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${a.primary}), hsl(${a.primary} / 0.7))`);

  root.dataset.font = prefs.font;
  root.dataset.bubble = prefs.bubble;
  root.dataset.wallpaper = prefs.wallpaper;
}

// Apply immediately on import (before React renders) to avoid FOUC
if (typeof window !== 'undefined') {
  applyUICustomization(load());
}

export const useUICustomization = () => {
  const [ui, setUI] = useState<UICustomization>(load);

  useEffect(() => {
    applyUICustomization(ui);
    localStorage.setItem(KEY, JSON.stringify(ui));
  }, [ui]);

  const update = useCallback(<K extends keyof UICustomization>(key: K, value: UICustomization[K]) => {
    setUI(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setUI(DEFAULTS), []);

  return { ui, update, reset };
};
