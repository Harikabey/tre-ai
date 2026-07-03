import { useEffect, useRef, useState, useCallback } from 'react';

const LS_KEY = 'ai_chatbot_wake_word';
const WAKE_PATTERNS = [
  /\bhey[\s,]+tre\b/i,
  /\bhey[\s,]+tree\b/i,
  /\bhey[\s,]+t(a|e)?re(y|i)?\b/i,
  /\bhi[\s,]+tre\b/i,
  /\bok(ey|ay)?[\s,]+tre\b/i,
];

export function isWakeWordEnabled(): boolean {
  return localStorage.getItem(LS_KEY) === 'true';
}

export function setWakeWordEnabled(v: boolean) {
  localStorage.setItem(LS_KEY, String(v));
  window.dispatchEvent(new CustomEvent('wake-word-changed', { detail: v }));
}

/**
 * Continuously listens (when enabled) for the "Hey Tre" wake phrase.
 * On detection, invokes onWake().
 */
export function useWakeWord(onWake: () => void) {
  const [enabled, setEnabled] = useState<boolean>(() => isWakeWordEnabled());
  const [isSupported, setIsSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const stopFlagRef = useRef(false);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    const handler = (e: Event) => setEnabled((e as CustomEvent).detail === true);
    window.addEventListener('wake-word-changed', handler);
    return () => window.removeEventListener('wake-word-changed', handler);
  }, []);

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SR);
    if (!SR || !enabled) return;

    let rec: any;
    stopFlagRef.current = false;

    const start = () => {
      try {
        rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'tr-TR';
        recRef.current = rec;

        rec.onstart = () => setListening(true);

        rec.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = (event.results[i][0]?.transcript || '').toLowerCase();
            if (WAKE_PATTERNS.some((p) => p.test(transcript))) {
              try { rec.stop(); } catch {}
              onWakeRef.current();
              return;
            }
          }
        };

        rec.onerror = (e: any) => {
          // "not-allowed" = mic permission denied; stop retrying
          if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
            stopFlagRef.current = true;
            setListening(false);
          }
        };

        rec.onend = () => {
          setListening(false);
          if (!stopFlagRef.current && isWakeWordEnabled()) {
            // auto-restart to keep it always-on
            setTimeout(() => {
              if (!stopFlagRef.current) start();
            }, 400);
          }
        };

        rec.start();
      } catch (e) {
        console.warn('WakeWord start failed', e);
      }
    };

    start();

    return () => {
      stopFlagRef.current = true;
      try { recRef.current?.abort(); } catch {}
      setListening(false);
    };
  }, [enabled]);

  const toggle = useCallback((v: boolean) => setWakeWordEnabled(v), []);

  return { enabled, isSupported, listening, toggle };
}
