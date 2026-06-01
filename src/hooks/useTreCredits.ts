import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

export type CreditAction = 'chat' | 'image' | 'gif' | 'audio' | 'video' | 'pptx' | 'deep';

// Tahmini Lovable AI kredi maliyetleri (her aksiyon başına birim)
export const CREDIT_COSTS: Record<CreditAction, number> = {
  chat: 1,
  deep: 3,
  image: 10,
  gif: 20,
  audio: 10,
  video: 25,
  pptx: 15,
};

const LS_USED = 'tre_credits_used';
const LS_LIMIT = 'tre_credits_limit';
const LS_MONTH = 'tre_credits_month';
const LS_WARNED = 'tre_credits_warned_80';
const LS_BLOCKED_WARNED = 'tre_credits_warned_100';

const DEFAULT_LIMIT = 1000;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function readNum(key: string, fallback: number) {
  const v = localStorage.getItem(key);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

export const useTreCredits = () => {
  const [limit, setLimitState] = useState<number>(() => readNum(LS_LIMIT, DEFAULT_LIMIT));
  const [used, setUsed] = useState<number>(() => {
    const month = localStorage.getItem(LS_MONTH);
    if (month !== currentMonthKey()) return 0;
    return readNum(LS_USED, 0);
  });

  // Aylık otomatik sıfırlama
  useEffect(() => {
    const month = localStorage.getItem(LS_MONTH);
    const now = currentMonthKey();
    if (month !== now) {
      localStorage.setItem(LS_MONTH, now);
      localStorage.setItem(LS_USED, '0');
      localStorage.removeItem(LS_WARNED);
      localStorage.removeItem(LS_BLOCKED_WARNED);
      setUsed(0);
    }
  }, []);

  const persist = (next: number) => {
    localStorage.setItem(LS_USED, String(next));
    localStorage.setItem(LS_MONTH, currentMonthKey());
  };

  const setLimit = useCallback((n: number) => {
    const safe = Math.max(50, Math.min(100000, Math.round(n)));
    localStorage.setItem(LS_LIMIT, String(safe));
    setLimitState(safe);
  }, []);

  const reset = useCallback(() => {
    persist(0);
    localStorage.removeItem(LS_WARNED);
    localStorage.removeItem(LS_BLOCKED_WARNED);
    setUsed(0);
  }, []);

  const lastToastRef = useRef<number>(0);

  const addUsage = useCallback((action: CreditAction, multiplier = 1) => {
    const cost = (CREDIT_COSTS[action] ?? 1) * Math.max(1, multiplier);
    setUsed(prev => {
      const next = prev + cost;
      persist(next);

      const pct = (next / limit) * 100;
      const prevPct = (prev / limit) * 100;

      // %80 uyarısı (ay başına bir kez)
      if (prevPct < 80 && pct >= 80 && pct < 100) {
        if (!localStorage.getItem(LS_WARNED)) {
          localStorage.setItem(LS_WARNED, '1');
          toast({
            title: '⚡ Tre Kredi: %80 kullanıldı',
            description: `Bu ay ${next}/${limit} kredi kullandın. Tasarruf moduna geçmeyi düşünebilirsin.`,
          });
        }
      }

      // %100 uyarısı
      if (prevPct < 100 && pct >= 100) {
        if (!localStorage.getItem(LS_BLOCKED_WARNED)) {
          localStorage.setItem(LS_BLOCKED_WARNED, '1');
          toast({
            title: '🚨 Tre Kredi limiti doldu',
            description: 'Aylık kredi limitin doldu. Ayarlardan limiti artırabilir veya yenilenmesini bekleyebilirsin.',
            variant: 'destructive',
          });
        }
      }
      return next;
    });
  }, [limit]);

  const percent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  return {
    used,
    limit,
    percent,
    isWarning: percent >= 80 && percent < 100,
    isExhausted: percent >= 100,
    addUsage,
    setLimit,
    reset,
    costs: CREDIT_COSTS,
  };
};
