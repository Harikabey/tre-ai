import { useCallback } from 'react';

export const useHapticFeedback = () => {
  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const lightTap = useCallback(() => vibrate(30), [vibrate]);
  const mediumTap = useCallback(() => vibrate(50), [vibrate]);
  const heavyTap = useCallback(() => vibrate(100), [vibrate]);
  const success = useCallback(() => vibrate([30, 50, 30]), [vibrate]);
  const warning = useCallback(() => vibrate([50, 30, 50, 30, 50]), [vibrate]);
  const voiceActivate = useCallback(() => vibrate([50, 30, 80]), [vibrate]);

  return { vibrate, lightTap, mediumTap, heavyTap, success, warning, voiceActivate };
};
