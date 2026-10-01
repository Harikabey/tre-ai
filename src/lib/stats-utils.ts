// FILE: src/lib/stats-utils.ts
export type TopicName = 'kod' | 'ödev' | 'duygu' | 'plan' | 'arama' | 'sohbet';

export const normalizeTrigger = (text: string): string => {
  const trimmed = text.trim().toLocaleLowerCase('tr-TR');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const stopWords = new Set([
  've', 'bir', 'bu', 'şu', 'o', 'ile', 'için', 'ama', 'ki', 'de', 'da', 'mı', 'mi', 'mu', 'mü',
  'çok', 'daha', 'en', 'gibi', 'kadar', 'sonra', 'önce', 'ise', 'ancak', 'fakat', 'çünkü', 'eğer',
  'hem', 'ya', 'veya', 'ben', 'sen', 'biz', 'siz', 'onlar', 'beni', 'seni', 'bana', 'sana', 'bizim',
  'sizin', 'var', 'yok', 'her', 'hiç', 'şey', 'herşey', 'birşey', 'böyle', 'şöyle', 'öyle', 'hangi',
  'nasıl', 'neden', 'niçin', 'nerede', 'nereye', 'nereden', 'kim', 'kime', 'kimi', 'kimin',
]);

const topicKeywords: Record<TopicName, string[]> = {
  kod: ['kod', 'code', 'function', 'react', 'python', 'javascript', 'debug', 'hata', 'bug', 'api'],
  ödev: ['ödev', 'sınav', 'ders', 'matematik', 'fizik', 'kimya', 'tarih', 'kitap', 'okul'],
  duygu: ['üzgün', 'mutlu', 'kızgın', 'stresli', 'yorgun', 'endişeli', 'heyecanlı'],
  plan: ['plan', 'hatırlat', 'takvim', 'randevu', 'toplantı', 'program'],
  arama: ['ara', 'bul', 'nedir', 'kim', 'nerede', 'nasıl'],
  sohbet: [],
};

export const detectTopic = (message: string): TopicName => {
  const normalized = message.toLocaleLowerCase('tr-TR');
  for (const topic of ['kod', 'ödev', 'duygu', 'plan', 'arama'] as const) {
    if (topicKeywords[topic].some(keyword => normalized.includes(keyword))) return topic;
  }
  return 'sohbet';
};

export const extractWords = (message: string): string[] => {
  try {
    return (message.toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}]+/gu) ?? [])
      .map(word => word.normalize('NFC'))
      .filter(word => [...word].length >= 3 && !stopWords.has(word));
  } catch {
    return [];
  }
};

export const formatDate = (date: string | Date): string => {
  try {
    const parsed = date instanceof Date ? date : new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(parsed);
  } catch {
    return '—';
  }
};

export const formatNumber = (value: number): string => {
  try {
    return new Intl.NumberFormat('tr-TR').format(Number.isFinite(value) ? value : 0);
  } catch {
    return String(Number.isFinite(value) ? value : 0);
  }
};

export const getTopItem = (counts: Record<string, number>): [string, number] | null => {
  const top = Object.entries(counts)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((first, second) => second[1] - first[1])[0];
  return top ?? null;
};

export const getPercentage = (value: number, total: number): number =>
  total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;

export const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLast7Days = (from = new Date()): string[] =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    date.setDate(date.getDate() - (6 - index));
    return getLocalDateKey(date);
  });