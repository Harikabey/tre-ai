// FILE: src/hooks/useCustomPersonality.ts
import { useCallback, useEffect, useState } from 'react';

const CUSTOM_PERSONALITY_KEY = 'tre_custom_personality';
const MAX_CUSTOM_PERSONALITY_LENGTH = 500;
const CUSTOM_PERSONALITY_EVENT = 'tre-custom-personality-changed';

const readCustomPersonality = (): string => {
  try {
    const storedValue = localStorage.getItem(CUSTOM_PERSONALITY_KEY);
    if (!storedValue) return '';

    const parsedValue: unknown = JSON.parse(storedValue);
    if (typeof parsedValue !== 'string') return '';

    const normalizedValue = parsedValue.trim();
    return normalizedValue.length <= MAX_CUSTOM_PERSONALITY_LENGTH ? normalizedValue : '';
  } catch (error) {
    console.error('Özel kişilik okunamadı:', error);
    return '';
  }
};

export const useCustomPersonality = () => {
  const [customPersonality, setCustomPersonalityState] = useState(readCustomPersonality);

  useEffect(() => {
    const syncCustomPersonality = () => {
      setCustomPersonalityState(readCustomPersonality());
    };

    window.addEventListener('storage', syncCustomPersonality);
    window.addEventListener(CUSTOM_PERSONALITY_EVENT, syncCustomPersonality);
    return () => {
      window.removeEventListener('storage', syncCustomPersonality);
      window.removeEventListener(CUSTOM_PERSONALITY_EVENT, syncCustomPersonality);
    };
  }, []);

  const setCustomPersonality = useCallback((text: string) => {
    const normalizedValue = text.trim();
    if (normalizedValue.length > MAX_CUSTOM_PERSONALITY_LENGTH) {
      throw new Error('Özel kişilik en fazla 500 karakter olabilir.');
    }

    try {
      if (normalizedValue) {
        localStorage.setItem(CUSTOM_PERSONALITY_KEY, JSON.stringify(normalizedValue));
      } else {
        localStorage.removeItem(CUSTOM_PERSONALITY_KEY);
      }
      setCustomPersonalityState(normalizedValue);
      window.dispatchEvent(new Event(CUSTOM_PERSONALITY_EVENT));
    } catch (error) {
      console.error('Özel kişilik kaydedilemedi:', error);
      throw error;
    }
  }, []);

  const clearCustomPersonality = useCallback(() => {
    try {
      localStorage.removeItem(CUSTOM_PERSONALITY_KEY);
      setCustomPersonalityState('');
      window.dispatchEvent(new Event(CUSTOM_PERSONALITY_EVENT));
    } catch (error) {
      console.error('Özel kişilik temizlenemedi:', error);
      throw error;
    }
  }, []);

  return {
    customPersonality,
    setCustomPersonality,
    clearCustomPersonality,
    isActive: customPersonality.length > 0,
  };
};