import { useMemo } from 'react';
import Papa from 'papaparse';

export type TreFikInputMode = 'math' | 'table' | 'health' | 'relations' | 'text';
export type TreFikVisualization = 'line' | 'bar' | 'pie' | 'radar' | 'network' | 'mindmap';

export interface TreFikNode {
  id: string;
  label: string;
}

export interface TreFikEdge {
  source: string;
  target: string;
  label?: string;
}

export interface TreFikAnalysis {
  visualization: TreFikVisualization;
  rows: Array<Record<string, string | number>>;
  seriesKeys: string[];
  categoryKey: string;
  nodes: TreFikNode[];
  edges: TreFikEdge[];
  topic: string;
  formula?: string;
  insights: string[];
  cleaningNotes: string[];
  error?: string;
}

interface ParsedTable {
  rows: Array<Record<string, string | number>>;
  cleaningNotes: string[];
}

const EMPTY_RESULT: TreFikAnalysis = {
  visualization: 'bar',
  rows: [],
  seriesKeys: [],
  categoryKey: 'Kategori',
  nodes: [],
  edges: [],
  topic: '',
  insights: [],
  cleaningNotes: [],
};

const normalizeHeader = (header: string) => header.trim().toLocaleLowerCase('tr-TR');

const parseTable = (text: string): ParsedTable => {
  if (!text.trim()) return { rows: [], cleaningNotes: [] };
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`Tablo okunamadı: ${parsed.errors[0].message}`);
  }

  const headers = parsed.meta.fields ?? [];
  if (headers.length < 2) throw new Error('Tabloda bir kategori ve en az bir veri sütunu olmalı.');

  let repaired = 0;
  const records = parsed.data.map((record, rowIndex) => {
    const row: Record<string, string | number> = {};
    for (const header of headers) {
      const rawValue = record[header]?.trim() ?? '';
      if (header === headers[0]) {
        row[header] = rawValue || `Satır ${rowIndex + 1}`;
        if (!rawValue) repaired += 1;
        continue;
      }

      const numericValue = Number(rawValue.replace(',', '.').replace(/[₺$€£%\s]/g, ''));
      if (rawValue && Number.isFinite(numericValue)) {
        row[header] = numericValue;
      } else {
        row[header] = Number.NaN;
      }
    }
    return row;
  });

  const numericHeaders = headers.slice(1).filter((header) => records.some((row) => (
    typeof row[header] === 'number' && Number.isFinite(row[header])
  )));
  if (numericHeaders.length === 0) throw new Error('Grafik için en az bir sayısal sütun bulunamadı.');

  for (const header of numericHeaders) {
    for (let index = 0; index < records.length; index += 1) {
      const value = records[index][header];
      if (typeof value === 'number' && Number.isFinite(value)) continue;

      let before = index - 1;
      while (before >= 0 && !(typeof records[before][header] === 'number' && Number.isFinite(records[before][header]))) before -= 1;
      let after = index + 1;
      while (after < records.length && !(typeof records[after][header] === 'number' && Number.isFinite(records[after][header]))) after += 1;

      const previous = before >= 0 ? records[before][header] as number : undefined;
      const next = after < records.length ? records[after][header] as number : undefined;
      const estimate = previous !== undefined && next !== undefined
        ? previous + ((next - previous) * (index - before)) / (after - before)
        : previous ?? next;
      records[index][header] = estimate ?? 0;
      repaired += 1;
    }
  }

  return {
    rows: records.map((row) => Object.fromEntries(
      Object.entries(row).filter(([key]) => key === headers[0] || numericHeaders.includes(key)),
    )),
    cleaningNotes: repaired > 0 ? [`${repaired} eksik veya hatalı hücre komşu verilerden düzeltildi.`] : [],
  };
};

const getNumericKeys = (rows: Array<Record<string, string | number>>, categoryKey: string) => (
  Object.keys(rows[0] ?? {}).filter((key) => key !== categoryKey && rows.some((row) => (
    typeof row[key] === 'number' && Number.isFinite(row[key])
  )))
);

const isDateCategory = (categoryKey: string, rows: Array<Record<string, string | number>>) => {
  const header = normalizeHeader(categoryKey);
  return /tarih|date|ay|month|hafta|week|gün|day|zaman|time/.test(header)
    || rows.some((row) => typeof row[categoryKey] === 'string'
      && /\b(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(row[categoryKey] as string));
};

const parseMathExpression = (source: string, x: number): number => {
  const expression = source.replace(/^\s*y\s*=\s*/i, '').replace(/\s+/g, '');
  if (!expression || expression.length > 240) throw new Error('Denklem boş veya çok uzun.');

  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)|(?:[xy])|[()+\-*/^]/gi) ?? [];
  if (tokens.length > 120 || tokens.join('') !== expression) {
    throw new Error('Denklemde desteklenmeyen karakter veya ifade var.');
  }

  const expanded: string[] = [];
  tokens.forEach((token, index) => {
    const previous = tokens[index - 1];
    if (previous && (/^(?:\d|\.)/.test(previous) || /^[xy]$/i.test(previous) || previous === ')')
      && (/^(?:\d|\.)/.test(token) || /^[xy]$/i.test(token) || token === '(')) {
      expanded.push('*');
    }
    expanded.push(token.toLowerCase());
  });

  let position = 0;
  const peek = () => expanded[position];
  const consume = () => expanded[position++];
  const parsePrimary = (): number => {
    const token = consume();
    if (token === undefined) throw new Error('Denklem tamamlanmamış.');
    if (token === '(') {
      const value = parseSum();
      if (consume() !== ')') throw new Error('Parantezler eşleşmiyor.');
      return value;
    }
    if (token === 'x') return x;
    if (token === 'y') throw new Error('Denklem yalnızca x değişkenini kullanabilir.');
    if (token === '+') return parsePrimary();
    if (token === '-') return -parsePrimary();
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error(`Geçersiz sayı: ${token}`);
    return value;
  };
  const parsePower = (): number => {
    const base = parsePrimary();
    if (peek() === '^') {
      consume();
      const exponent = parsePower();
      if (Math.abs(exponent) > 20) throw new Error('Üs değeri -20 ile 20 arasında olmalı.');
      return base ** exponent;
    }
    return base;
  };
  const parseProduct = (): number => {
    let value = parsePower();
    while (peek() === '*' || peek() === '/') {
      const operator = consume();
      const right = parsePower();
      if (operator === '/' && right === 0) throw new Error('Sıfıra bölme yapılamaz.');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const parseSum = (): number => {
    let value = parseProduct();
    while (peek() === '+' || peek() === '-') {
      const operator = consume();
      const right = parseProduct();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const result = parseSum();
  if (position !== expanded.length || !Number.isFinite(result)) {
    throw new Error('Denklem geçersiz veya sonucu tanımsız.');
  }
  return result;
};

const analyzeMath = (text: string): TreFikAnalysis => {
  const formula = text.trim();
  const start = -10;
  const end = 10;
  const count = 81;
  const rows = Array.from({ length: count }, (_, index) => {
    const x = start + ((end - start) * index) / (count - 1);
    return { x: Number(x.toFixed(2)), y: Number(parseMathExpression(formula, x).toFixed(4)) };
  });
  return {
    ...EMPTY_RESULT,
    visualization: 'line',
    rows,
    categoryKey: 'x',
    seriesKeys: ['y'],
    formula,
    topic: formula,
    insights: [`y değerleri x = ${start} ile x = ${end} arasında örneklendi.`],
  };
};

const analyzeHealth = (text: string): TreFikAnalysis => {
  const { rows, cleaningNotes } = parseTable(text);
  const categoryKey = Object.keys(rows[0] ?? {})[0] ?? 'Tarih';
  const seriesKeys = getNumericKeys(rows, categoryKey);
  return {
    ...EMPTY_RESULT,
    visualization: 'radar',
    rows,
    categoryKey,
    seriesKeys,
    topic: 'Sağlık ve spor',
    insights: [`${rows.length} dönem ve ${seriesKeys.length} sağlık ölçümü karşılaştırılıyor.`],
    cleaningNotes,
  };
};

const analyzeRelations = (text: string): TreFikAnalysis => {
  const edges = text.split(/\r?\n/).flatMap((line): TreFikEdge[] => {
    const arrow = line.match(/^\s*(.+?)\s*(?:->|→)\s*(.+?)(?:\s*:\s*(.+))?\s*$/);
    if (arrow) return [{ source: arrow[1].trim(), target: arrow[2].trim(), label: arrow[3]?.trim() }];
    const sentence = line.match(/^\s*([^,]+),\s*([^'’]+?)(?:['’](?:la|le))?\s+(.+?)\s*$/u);
    if (sentence) return [{ source: sentence[1].trim(), target: sentence[2].trim(), label: sentence[3].trim() }];
    return [];
  }).filter((edge) => edge.source && edge.target && edge.source !== edge.target);

  if (edges.length === 0) {
    throw new Error('Bağlantıları “Ahmet, Mehmet’le çalışıyor” veya “Ahmet -> Mehmet: iş arkadaşı” biçiminde yazın.');
  }

  const labels = [...new Set(edges.flatMap((edge) => [edge.source, edge.target]))];
  return {
    ...EMPTY_RESULT,
    visualization: 'network',
    nodes: labels.map((label, index) => ({ id: `person-${index}`, label })),
    edges,
    topic: 'İlişki ağı',
    insights: [`${labels.length} kişi arasında ${edges.length} bağlantı bulundu.`],
  };
};

const STOP_WORDS = new Set([
  'acaba', 'ama', 'ancak', 'artık', 'aslında', 'az', 'bazı', 'belki', 'ben', 'bile', 'bir', 'birçok',
  'bu', 'çok', 'çünkü', 'da', 'daha', 'de', 'diye', 'en', 'gibi', 'hem', 'her', 'için', 'ile',
  'ise', 'kadar', 'kendi', 'ki', 'mı', 'mi', 'mu', 'mü', 'ne', 'o', 'olarak', 'önce', 'sonra',
  've', 'veya', 'ya', 'yani', 'yeni', 'ile', 'the', 'and', 'for', 'from', 'into', 'that', 'this',
]);

const analyzeText = (text: string): TreFikAnalysis => {
  const words = text.toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const counts = new Map<string, number>();
  words.filter((word) => !STOP_WORDS.has(word)).forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([word]) => word);
  const topic = keywords[0] ?? text.trim().split(/\s+/)[0] ?? 'Kavram';
  const nodes = [topic, ...keywords.filter((word) => word !== topic)].map((label, index) => ({
    id: `concept-${index}`,
    label,
  }));
  const sentences = text.split(/[.!?;]+/).map((sentence) => sentence.trim()).filter(Boolean);
  return {
    ...EMPTY_RESULT,
    visualization: 'mindmap',
    nodes,
    edges: nodes.slice(1).map((node) => ({ source: topic, target: node.label })),
    topic: topic.charAt(0).toLocaleUpperCase('tr-TR') + topic.slice(1),
    insights: [`Metinden ${nodes.length} ana kavram çıkarıldı; ${sentences.length} cümle tarandı.`],
  };
};

const analyzeTable = (text: string): TreFikAnalysis => {
  const { rows, cleaningNotes } = parseTable(text);
  const categoryKey = Object.keys(rows[0] ?? {})[0] ?? 'Kategori';
  const seriesKeys = getNumericKeys(rows, categoryKey);
  const dateLike = isDateCategory(categoryKey, rows);
  const visualization: TreFikVisualization = dateLike
    ? 'line'
    : seriesKeys.length === 1 && rows.length <= 7
      ? 'pie'
      : 'bar';
  const firstNumericKey = seriesKeys[0];
  const numbers = rows.map((row) => row[firstNumericKey] as number);
  const total = numbers.reduce((sum, value) => sum + value, 0);
  const insights = [`${rows.length} satır ve ${seriesKeys.length} sayısal sütun analiz edildi.`];
  const largestDrop = seriesKeys.flatMap((key) => rows.slice(1).flatMap((row, index) => {
    const previousValue = Number(rows[index][key]);
    const currentValue = Number(row[key]);
    return currentValue < previousValue
      ? [{ key, category: row[categoryKey], amount: previousValue - currentValue }]
      : [];
  })).sort((a, b) => b.amount - a.amount)[0];
  if (largestDrop) {
    insights.push(`${largestDrop.category} döneminde ${largestDrop.key} ${largestDrop.amount.toLocaleString('tr-TR')} azaldı.`);
  }
  if (visualization === 'pie' && total > 0) {
    const largest = rows.reduce((best, row) => (row[firstNumericKey] as number) > (best[firstNumericKey] as number) ? row : best, rows[0]);
    insights.push(`${largest[categoryKey]} en büyük paya sahip.`);
  }
  return {
    ...EMPTY_RESULT,
    visualization,
    rows,
    categoryKey,
    seriesKeys,
    topic: 'Tablo analizi',
    insights,
    cleaningNotes,
  };
};

export const analyzeTreFikInput = (mode: TreFikInputMode, input: string): TreFikAnalysis => {
  if (!input.trim()) return EMPTY_RESULT;
  try {
    if (mode === 'math') return analyzeMath(input);
    if (mode === 'health') return analyzeHealth(input);
    if (mode === 'relations') return analyzeRelations(input);
    if (mode === 'text') return analyzeText(input);
    return analyzeTable(input);
  } catch (error) {
    return {
      ...EMPTY_RESULT,
      error: error instanceof Error ? error.message : 'Girdi analiz edilemedi.',
    };
  }
};

export const useDataAnalyzer = (mode: TreFikInputMode, input: string): TreFikAnalysis => (
  useMemo(() => analyzeTreFikInput(mode, input), [mode, input])
);
