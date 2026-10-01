// FILE: src/hooks/useUserShortcuts.ts
import { useCallback, useEffect, useState } from 'react';
import { normalizeTrigger } from '@/lib/stats-utils';

export interface UserShortcut {
  id: string;
  trigger: string;
  actionText: string;
  createdAt: number;
}

interface ShortcutResult {
  success: boolean;
  error?: string;
}

const STORAGE_KEY = 'tre_user_shortcuts';

const readShortcuts = (): UserShortcut[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is UserShortcut =>
      typeof item === 'object' && item !== null &&
      typeof item.id === 'string' && typeof item.trigger === 'string' &&
      typeof item.actionText === 'string' && typeof item.createdAt === 'number'
    );
  } catch {
    return [];
  }
};

const validateShortcut = (
  trigger: string,
  actionText: string,
  shortcuts: UserShortcut[],
  ignoredId?: string,
): ShortcutResult => {
  const normalizedTrigger = normalizeTrigger(trigger);
  if (!trigger.trim() || !actionText.trim()) {
    return { success: false, error: 'Kısayol kodu ve metin boş olamaz.' };
  }
  if (/\s/.test(normalizedTrigger)) {
    return { success: false, error: 'Kısayol kodunda boşluk kullanılamaz.' };
  }
  if (normalizedTrigger.length > 20) {
    return { success: false, error: 'Kısayol kodu en fazla 20 karakter olabilir.' };
  }
  if (actionText.length > 5000) {
    return { success: false, error: 'Genişletilecek metin en fazla 5000 karakter olabilir.' };
  }
  if (shortcuts.some(shortcut =>
    shortcut.id !== ignoredId && normalizeTrigger(shortcut.trigger) === normalizedTrigger
  )) {
    return { success: false, error: 'Bu kısayol kodu zaten kullanılıyor.' };
  }
  return { success: true };
};

export const useUserShortcuts = () => {
  const [shortcuts, setShortcuts] = useState<UserShortcut[]>([]);

  useEffect(() => {
    setShortcuts(readShortcuts());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setShortcuts(readShortcuts());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const saveShortcuts = useCallback((nextShortcuts: UserShortcut[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextShortcuts));
    setShortcuts(nextShortcuts);
  }, []);

  const addShortcut = useCallback((trigger: string, actionText: string): ShortcutResult => {
    const currentShortcuts = readShortcuts();
    const result = validateShortcut(trigger, actionText, currentShortcuts);
    if (!result.success) return result;

    saveShortcuts([...currentShortcuts, {
      id: crypto.randomUUID(),
      trigger: normalizeTrigger(trigger),
      actionText,
      createdAt: Date.now(),
    }]);
    return { success: true };
  }, [saveShortcuts]);

  const updateShortcut = useCallback((id: string, trigger: string, actionText: string): ShortcutResult => {
    const currentShortcuts = readShortcuts();
    const existing = currentShortcuts.find(shortcut => shortcut.id === id);
    if (!existing) return { success: false, error: 'Kısayol bulunamadı.' };
    const result = validateShortcut(trigger, actionText, currentShortcuts, id);
    if (!result.success) return result;

    saveShortcuts(currentShortcuts.map(shortcut => shortcut.id === id
      ? { ...shortcut, trigger: normalizeTrigger(trigger), actionText }
      : shortcut
    ));
    return { success: true };
  }, [saveShortcuts]);

  const deleteShortcut = useCallback((id: string) => {
    saveShortcuts(readShortcuts().filter(shortcut => shortcut.id !== id));
  }, [saveShortcuts]);

  const getShortcutByTrigger = useCallback((trigger: string) => {
    const normalizedTrigger = normalizeTrigger(trigger);
    return shortcuts.find(shortcut => normalizeTrigger(shortcut.trigger) === normalizedTrigger);
  }, [shortcuts]);

  return { shortcuts, addShortcut, updateShortcut, deleteShortcut, getShortcutByTrigger };
};