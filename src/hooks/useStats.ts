// FILE: src/hooks/useStats.ts
import { useCallback, useRef, useState } from 'react';
import { detectTopic, extractWords, getLocalDateKey, getTopItem } from '@/lib/stats-utils';

const STORAGE_KEY = 'tre_stats_data';

export interface StatsData {
  totalMessages: number;
  totalUserMessages: number;
  totalTreMessages: number;
  totalWords: number;
  totalCharacters: number;
  firstMessageDate: string;
  lastMessageDate: string;
  activeDays: string[];
  hourlyActivity: Record<string, number>;
  dailyActivity: Record<string, number>;
  topicCounts: Record<string, number>;
  sentimentCounts: Record<string, number>;
  wordFrequency: Record<string, number>;
}

export interface StatsSummary {
  totalMessages: number;
  totalWords: number;
  firstMessageDate: string;
  activeDays: number;
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  lastMonth: number;
  busiestDay: [string, number] | null;
  busiestHour: [string, number] | null;
  topTopic: [string, number] | null;
  topSentiment: [string, number] | null;
}

const emptyStats = (): StatsData => ({
  totalMessages: 0,
  totalUserMessages: 0,
  totalTreMessages: 0,
  totalWords: 0,
  totalCharacters: 0,
  firstMessageDate: '',
  lastMessageDate: '',
  activeDays: [],
  hourlyActivity: {},
  dailyActivity: {},
  topicCounts: {},
  sentimentCounts: {},
  wordFrequency: {},
});

const safeCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

const safeCounts = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => typeof key === 'string')
      .map(([key, count]) => [key, safeCount(count)]),
  );
};

const loadStats = (): StatsData => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<StatsData>;
    const defaults = emptyStats();
    return {
      ...defaults,
      totalMessages: safeCount(parsed.totalMessages),
      totalUserMessages: safeCount(parsed.totalUserMessages),
      totalTreMessages: safeCount(parsed.totalTreMessages),
      totalWords: safeCount(parsed.totalWords),
      totalCharacters: safeCount(parsed.totalCharacters),
      firstMessageDate: typeof parsed.firstMessageDate === 'string' ? parsed.firstMessageDate : '',
      lastMessageDate: typeof parsed.lastMessageDate === 'string' ? parsed.lastMessageDate : '',
      activeDays: Array.isArray(parsed.activeDays) ? parsed.activeDays.filter(day => typeof day === 'string') : [],
      hourlyActivity: safeCounts(parsed.hourlyActivity),
      dailyActivity: safeCounts(parsed.dailyActivity),
      topicCounts: safeCounts(parsed.topicCounts),
      sentimentCounts: safeCounts(parsed.sentimentCounts),
      wordFrequency: safeCounts(parsed.wordFrequency),
    };
  } catch {
    return emptyStats();
  }
};

export const useStats = () => {
  const [stats, setStats] = useState<StatsData>(loadStats);
  const statsRef = useRef(stats);

  const commitStats = useCallback((next: StatsData) => {
    statsRef.current = next;
    setStats(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Statistics remain available for this page view if storage is unavailable.
    }
  }, []);

  const recordMessage = useCallback((message: string, sender: 'user' | 'tre', mood?: string | null) => {
    try {
      const now = new Date();
      const dateKey = getLocalDateKey(now);
      const hourKey = String(now.getHours());
      const words = extractWords(message);
      const current = statsRef.current;
      const wordFrequency = { ...current.wordFrequency };
      words.forEach(word => { wordFrequency[word] = (wordFrequency[word] ?? 0) + 1; });
      const sentimentCounts = { ...current.sentimentCounts };
      if (mood?.trim()) {
        const normalizedMood = mood.trim().toLocaleLowerCase('tr-TR');
        sentimentCounts[normalizedMood] = (sentimentCounts[normalizedMood] ?? 0) + 1;
      }
      const topic = detectTopic(message);

      commitStats({
        ...current,
        totalMessages: current.totalMessages + 1,
        totalUserMessages: current.totalUserMessages + (sender === 'user' ? 1 : 0),
        totalTreMessages: current.totalTreMessages + (sender === 'tre' ? 1 : 0),
        totalWords: current.totalWords + words.length,
        totalCharacters: current.totalCharacters + [...message].length,
        firstMessageDate: current.firstMessageDate || dateKey,
        lastMessageDate: dateKey,
        activeDays: current.activeDays.includes(dateKey) ? current.activeDays : [...current.activeDays, dateKey],
        hourlyActivity: { ...current.hourlyActivity, [hourKey]: (current.hourlyActivity[hourKey] ?? 0) + 1 },
        dailyActivity: { ...current.dailyActivity, [dateKey]: (current.dailyActivity[dateKey] ?? 0) + 1 },
        topicCounts: { ...current.topicCounts, [topic]: (current.topicCounts[topic] ?? 0) + 1 },
        sentimentCounts,
        wordFrequency,
      });
    } catch {
      // A malformed message must not interrupt chat.
    }
  }, [commitStats]);

  const resetStats = useCallback(() => {
    const empty = emptyStats();
    statsRef.current = empty;
    setStats(empty);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Keep the in-memory reset even when local storage is unavailable.
    }
  }, []);

  const getSummary = useCallback((): StatsSummary => {
    const current = statsRef.current;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOffset = (date: Date) => Math.round((
      Date.UTC(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    ) / 86400000);
    const dailyEntries = Object.entries(current.dailyActivity);
    const thisWeek = dailyEntries.reduce((sum, [day, count]) => {
      const offset = dayOffset(new Date(`${day}T00:00:00`));
      return sum + (offset >= 0 && offset < 7 ? count : 0);
    }, 0);
    const lastWeek = dailyEntries.reduce((sum, [day, count]) => {
      const offset = dayOffset(new Date(`${day}T00:00:00`));
      return sum + (offset >= 7 && offset < 14 ? count : 0);
    }, 0);
    const thisMonth = dailyEntries.reduce((sum, [day, count]) => {
      const offset = dayOffset(new Date(`${day}T00:00:00`));
      return sum + (offset >= 0 && offset < 30 ? count : 0);
    }, 0);
    const lastMonth = dailyEntries.reduce((sum, [day, count]) => {
      const offset = dayOffset(new Date(`${day}T00:00:00`));
      return sum + (offset >= 30 && offset < 60 ? count : 0);
    }, 0);
    const weeklyDays = Object.fromEntries(dailyEntries.filter(([day]) => {
      const offset = dayOffset(new Date(`${day}T00:00:00`));
      return offset >= 0 && offset < 7;
    }));

    return {
      totalMessages: current.totalMessages,
      totalWords: current.totalWords,
      firstMessageDate: current.firstMessageDate,
      activeDays: current.activeDays.length,
      thisWeek,
      lastWeek,
      thisMonth,
      lastMonth,
      busiestDay: getTopItem(weeklyDays),
      busiestHour: getTopItem(current.hourlyActivity),
      topTopic: getTopItem(current.topicCounts),
      topSentiment: getTopItem(current.sentimentCounts),
    };
  }, []);

  const getTopWords = useCallback((count = 3): [string, number][] =>
    Object.entries(statsRef.current.wordFrequency)
      .sort((first, second) => second[1] - first[1])
      .slice(0, Math.max(0, count)), []);

  return { stats, recordMessage, resetStats, getSummary, getTopWords };
};