// FILE: src/hooks/useStreak.ts
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string;
  freezesAvailable: number;
  freezeUsedDates: string[];
}

const STORAGE_KEY = 'tre_streak_data';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const subscribers = new Set<(data: StreakData) => void>();

const createEmptyData = (): StreakData => ({
  currentStreak: 0,
  longestStreak: 0,
  lastLoginDate: '',
  freezesAvailable: 0,
  freezeUsedDates: [],
});

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value: string): boolean {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isDateStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((date: unknown) => typeof date === 'string' && isValidDateString(date));
}

function normalizeData(value: unknown): StreakData | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const { currentStreak, longestStreak, lastLoginDate, freezesAvailable, freezeUsedDates } = candidate;

  if (
    typeof currentStreak !== 'number' || !Number.isInteger(currentStreak) || currentStreak < 0 ||
    typeof longestStreak !== 'number' || !Number.isInteger(longestStreak) || longestStreak < 0 ||
    typeof lastLoginDate !== 'string' || !isValidDateString(lastLoginDate) ||
    typeof freezesAvailable !== 'number' || !Number.isInteger(freezesAvailable) || freezesAvailable < 0 ||
    !isDateStringArray(freezeUsedDates)
  ) {
    return null;
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastLoginDate,
    freezesAvailable: Math.min(freezesAvailable, 5),
    freezeUsedDates,
  };
}

function readStoredData(): StreakData | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    return normalizeData(JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

function publish(data: StreakData): void {
  subscribers.forEach((subscriber) => subscriber(data));
}

function saveData(data: StreakData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Keep the in-memory streak usable when storage is unavailable or full.
  }
  publish(data);
}

function applyTodayLogin(data: StreakData): StreakData {
  const today = getLocalDateString();
  if (!data.lastLoginDate) {
    return { ...data, currentStreak: 1, longestStreak: Math.max(data.longestStreak, 1), lastLoginDate: today };
  }

  const [year, month, day] = data.lastLoginDate.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const lastDate = new Date(year, month - 1, day, 12);
  const todayDate = new Date(todayYear, todayMonth - 1, todayDay, 12);
  const dayDifference = Math.round((todayDate.getTime() - lastDate.getTime()) / DAY_IN_MS);

  if (dayDifference === 0 || dayDifference < 0) return data;
  if (dayDifference === 1) {
    const currentStreak = data.currentStreak + 1;
    return {
      ...data,
      currentStreak,
      longestStreak: Math.max(data.longestStreak, currentStreak),
      lastLoginDate: today,
    };
  }

  if (data.freezesAvailable > 0) {
    return {
      ...data,
      freezesAvailable: data.freezesAvailable - 1,
      freezeUsedDates: [...data.freezeUsedDates, data.lastLoginDate],
      lastLoginDate: today,
    };
  }

  return { ...data, currentStreak: 1, lastLoginDate: today };
}

export function useStreak() {
  const [data, setData] = useState<StreakData>(createEmptyData);
  const { toast } = useToast();

  useEffect(() => {
    const update = (nextData: StreakData) => setData(nextData);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      if (event.newValue === null) {
        update(createEmptyData());
        return;
      }

      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(event.newValue) as unknown;
      } catch {
        parsedValue = null;
      }
      const stored = normalizeData(parsedValue);
      const nextData = applyTodayLogin(stored ?? createEmptyData());
      if (JSON.stringify(nextData) === event.newValue) {
        update(nextData);
      } else {
        saveData(nextData);
      }
    };

    subscribers.add(update);
    window.addEventListener('storage', handleStorage);
    const nextData = applyTodayLogin(readStoredData() ?? createEmptyData());
    setData(nextData);
    saveData(nextData);

    return () => {
      subscribers.delete(update);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const addFreeze = () => {
    const latestData = readStoredData() ?? data;
    if (latestData.freezesAvailable >= 5) {
      toast({
        title: 'Dondurma sınırı',
        description: 'En fazla 5 dondurma biriktirebilirsin.',
      });
      return;
    }

    const nextData = { ...latestData, freezesAvailable: latestData.freezesAvailable + 1 };
    setData(nextData);
    saveData(nextData);
  };

  const resetStreak = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset the in-memory state even when storage cannot be accessed.
    }
    const emptyData = createEmptyData();
    setData(emptyData);
    publish(emptyData);
  };

  return {
    currentStreak: data.currentStreak,
    longestStreak: data.longestStreak,
    freezesAvailable: data.freezesAvailable,
    todayChecked: data.lastLoginDate === getLocalDateString(),
    addFreeze,
    resetStreak,
  };
}