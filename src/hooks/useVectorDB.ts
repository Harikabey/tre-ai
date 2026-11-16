import { useCallback, useState } from 'react';

const DATABASE_NAME = 'treforge_knowledge';
const DATABASE_VERSION = 1;
const STORE_NAME = 'chunks';
const EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;
const EMBEDDING_BATCH_SIZE = 8;

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  text: string;
  embedding: number[];
}

export interface KnowledgeSource {
  sourceId: string;
  chunkCount: number;
}

type FeatureExtractor = Awaited<ReturnType<typeof import('@huggingface/transformers').pipeline<'feature-extraction'>>>;

let databasePromise: Promise<IDBDatabase> | null = null;
let extractorPromise: Promise<FeatureExtractor> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('sourceId', 'sourceId');
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = null;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error('TreForge veritabanı açılamadı.'));
    };
  });
  return databasePromise;
}

function getExtractor(onStatus: (message: string) => void = () => {}): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers')
      .then(({ pipeline }) => {
        const reportedProgress = new Map<string, number>();
        return pipeline('feature-extraction', EMBEDDING_MODEL, {
          device: 'wasm',
          dtype: 'q8',
          progress_callback: (progress) => {
            if (progress.status === 'ready') {
              onStatus('Yerel embedding modeli hazır.');
            } else if (progress.status === 'progress_total') {
              const milestone = Math.floor(progress.progress / 25) * 25;
              if (milestone > (reportedProgress.get(progress.name) ?? 0)) {
                reportedProgress.set(progress.name, milestone);
                onStatus(`Yerel embedding modeli indiriliyor (%${milestone})...`);
              }
            }
          },
        });
      })
      .catch((error: unknown) => {
        extractorPromise = null;
        throw error;
      });
  }
  return extractorPromise;
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf(' ', end));
      if (boundary > start + CHUNK_SIZE * 0.6) end = boundary;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === text.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }
  return chunks;
}

function writeSourceChunks(database: IDBDatabase, sourceId: string, chunks: KnowledgeChunk[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('sourceId');
    const request = index.openKeyCursor(IDBKeyRange.only(sourceId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
        return;
      }
      chunks.forEach((chunk) => store.put(chunk));
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Bilgi tabanı kaydedilemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Bilgi tabanı kaydı iptal edildi.'));
  });
}

export function useVectorDB() {
  const [isEmbedding, setIsEmbedding] = useState(false);

  const indexSource = useCallback(async (
    sourceId: string,
    text: string,
    onProgress: (completed: number, total: number) => void = () => {},
    onStatus: (message: string) => void = () => {},
  ) => {
    if (typeof indexedDB === 'undefined') throw new Error('Bu tarayıcı IndexedDB’yi desteklemiyor.');
    if (!text.trim()) throw new Error('İndekslenecek metin boş.');
    setIsEmbedding(true);
    try {
      const texts = splitIntoChunks(text);
      const extractor = await getExtractor(onStatus);
      const chunks: KnowledgeChunk[] = [];
      for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
        const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
        const output = await extractor(batch, { pooling: 'mean', normalize: true });
        const dimensions = output.dims.at(-1);
        const values = Array.from(output.data, (value) => Number(value));
        if (!dimensions || values.length !== batch.length * dimensions || values.some((value) => !Number.isFinite(value))) {
          throw new Error('Embedding modeli beklenmeyen boyutta çıktı üretti.');
        }
        batch.forEach((chunkText, index) => {
          const vectorStart = index * dimensions;
          chunks.push({
            id: `${sourceId}:${offset + index}`,
            sourceId,
            text: chunkText,
            embedding: values.slice(vectorStart, vectorStart + dimensions),
          });
        });
        onProgress(Math.min(offset + batch.length, texts.length), texts.length);
      }
      await writeSourceChunks(await openDatabase(), sourceId, chunks);
      return chunks.length;
    } finally {
      setIsEmbedding(false);
    }
  }, []);

  const searchSimilar = useCallback(async (query: string, sourceId: string, limit = 3) => {
    if (!query.trim()) throw new Error('Önce bir soru yazın.');
    const extractor = await getExtractor();
    const queryOutput = await extractor(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryOutput.data, (value) => Number(value));
    const database = await openDatabase();
    const records = await new Promise<KnowledgeChunk[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .index('sourceId')
        .getAll(IDBKeyRange.only(sourceId));
      request.onsuccess = () => resolve(request.result as KnowledgeChunk[]);
      request.onerror = () => reject(request.error ?? new Error('Bilgi tabanı okunamadı.'));
    });
    if (!records.length) throw new Error('Bu kaynak için kayıtlı bilgi bulunamadı.');

    return records
      .map((record) => {
        const dotProduct = record.embedding.reduce(
          (sum, value, index) => sum + value * (queryVector[index] ?? 0),
          0,
        );
        const magnitudeA = Math.sqrt(record.embedding.reduce((sum, value) => sum + value * value, 0));
        const magnitudeB = Math.sqrt(queryVector.reduce((sum, value) => sum + value * value, 0));
        return {
          text: record.text,
          score: magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }, []);

  const getSources = useCallback(async (): Promise<KnowledgeSource[]> => {
    if (typeof indexedDB === 'undefined') return [];
    const database = await openDatabase();
    const records = await new Promise<KnowledgeChunk[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as KnowledgeChunk[]);
      request.onerror = () => reject(request.error ?? new Error('Bilgi tabanı kaynakları okunamadı.'));
    });
    const counts = new Map<string, number>();
    records.forEach(({ sourceId }) => counts.set(sourceId, (counts.get(sourceId) ?? 0) + 1));
    return Array.from(counts, ([sourceId, chunkCount]) => ({ sourceId, chunkCount }));
  }, []);

  return { indexSource, searchSimilar, getSources, isEmbedding };
}
