// FILE: src/hooks/useDemoLimit.ts
import { useCallback, useState } from 'react';

export const DEMO_USED_KEY = 'tre_demo_used';

const readDemoUsed = (): boolean => {
  try {
    return localStorage.getItem(DEMO_USED_KEY) === 'true';
  } catch {
    return false;
  }
};

export function useDemoLimit() {
  const [isUsed, setIsUsed] = useState(readDemoUsed);

  const markUsed = useCallback(() => {
    try {
      localStorage.setItem(DEMO_USED_KEY, 'true');
      setIsUsed(true);
    } catch (error) {
      console.error('Demo kullanımı kaydedilemedi:', error);
      setIsUsed(true);
    }
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_USED_KEY);
      setIsUsed(false);
    } catch (error) {
      console.error('Demo kullanımı sıfırlanamadı:', error);
      setIsUsed(readDemoUsed());
    }
  }, []);

  return { isUsed, markUsed, reset };
}
