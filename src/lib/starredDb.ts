export interface StarredMessage {
  messageId: string;
  chatId: string | null;
  chatTitle?: string;
  text: string;
  timestamp: number;
  sender: 'user' | 'bot';
}

const DB_NAME = 'tre_starred_messages';
const STORE = 'starred';

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'messageId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const listStarred = async (): Promise<StarredMessage[]> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(((req.result || []) as StarredMessage[]).sort((a, b) => b.timestamp - a.timestamp));
    req.onerror = () => reject(req.error);
  });
};

export const isStarred = async (messageId: string): Promise<boolean> => {
  const db = await openDb();
  return new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(messageId);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => resolve(false);
  });
};

export const addStarred = async (item: StarredMessage) => {
  const db = await openDb();
  db.transaction(STORE, 'readwrite').objectStore(STORE).put(item);
};

export const removeStarred = async (messageId: string) => {
  const db = await openDb();
  db.transaction(STORE, 'readwrite').objectStore(STORE).delete(messageId);
};
