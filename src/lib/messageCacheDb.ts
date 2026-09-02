// IndexedDB cache for chat messages with LZString compression.
import LZString from 'lz-string';

export interface CachedMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  /** LZString-compressed content */
  c: string;
  created_at: string;
}

export interface PlainMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const DB_NAME = 'tre_message_cache';
const STORE = 'messages';
const VERSION = 1;

export const PAGE_SIZE = 20;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('conv_time', ['conversation_id', 'created_at']);
        store.createIndex('conversation_id', 'conversation_id');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export const compress = (text: string) => LZString.compressToUTF16(text ?? '');
export const decompress = (packed: string) => {
  try {
    return LZString.decompressFromUTF16(packed) ?? '';
  } catch {
    return '';
  }
};

const toPlain = (m: CachedMessage): PlainMessage => ({
  id: m.id,
  conversation_id: m.conversation_id,
  role: m.role,
  content: decompress(m.c),
  created_at: m.created_at,
});

/** Store (upsert) messages, compressing content. */
export async function cacheMessages(messages: PlainMessage[]): Promise<void> {
  if (!messages.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    for (const m of messages) {
      const row: CachedMessage = {
        id: m.id,
        conversation_id: m.conversation_id,
        role: m.role,
        c: compress(m.content),
        created_at: m.created_at,
      };
      store.put(row);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/**
 * Read a page of messages older than `before` (ISO string), newest-first traversal,
 * returned in chronological order.
 */
export async function getCachedPage(
  conversationId: string,
  before?: string,
  limit = PAGE_SIZE,
): Promise<PlainMessage[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const idx = t.objectStore(STORE).index('conv_time');
    const upper = before ?? '\uffff';
    const range = IDBKeyRange.bound(
      [conversationId, ''],
      [conversationId, upper],
      false,
      !!before, // exclude the boundary message itself when paginating
    );
    const out: PlainMessage[] = [];
    const req = idx.openCursor(range, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) {
        resolve(out.reverse());
        return;
      }
      out.push(toPlain(cursor.value as CachedMessage));
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCachedMessage(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function clearConversationCache(conversationId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const idx = t.objectStore(STORE).index('conversation_id');
    const req = idx.openCursor(IDBKeyRange.only(conversationId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
