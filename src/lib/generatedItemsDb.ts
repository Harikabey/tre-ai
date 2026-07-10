// IndexedDB wrapper for locally-stored generated items (no cloud upload).

export type GeneratedItemKind =
  | 'image'
  | 'gif'
  | 'video'
  | 'audio'
  | 'code'
  | 'document'
  | 'apk'
  | 'iso'
  | 'pptx'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'other';

export interface GeneratedItem {
  id: string;
  name: string;
  kind: GeneratedItemKind;
  mimeType: string;
  size: number;
  blob: Blob;
  prompt?: string;
  createdAt: number;
}

const DB_NAME = 'tre_generated_items';
const STORE = 'items';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    if (result instanceof Promise) {
      result.then(resolve, reject);
      return;
    }
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error);
  });
}

export async function listItems(): Promise<GeneratedItem[]> {
  return tx('readonly', (s) => {
    return new Promise<GeneratedItem[]>((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => {
        const arr = (req.result as GeneratedItem[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(arr);
      };
      req.onerror = () => reject(req.error);
    }) as any;
  });
}

export async function addItem(item: Omit<GeneratedItem, 'id' | 'createdAt' | 'size'> & { id?: string; createdAt?: number }): Promise<GeneratedItem> {
  const full: GeneratedItem = {
    id: item.id || `gi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: item.createdAt || Date.now(),
    size: item.blob.size,
    ...item,
  } as GeneratedItem;
  await tx('readwrite', (s) => s.put(full));
  return full;
}

export async function deleteItem(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function renameItem(id: string, newName: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as GeneratedItem | undefined;
      if (!item) return resolve();
      item.name = newName;
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function clearItems(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}

export function kindFromMimeOrName(mimeType: string, name: string): GeneratedItemKind {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/gif') || ext === 'gif') return 'gif';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (ext === 'apk') return 'apk';
  if (ext === 'iso') return 'iso';
  if (ext === 'pptx' || ext === 'ppt') return 'pptx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'excel';
  const codeExts = ['js','ts','tsx','jsx','py','java','c','cpp','h','hpp','cs','go','rs','rb','php','swift','kt','html','css','scss','json','xml','yaml','yml','sh','bash','sql','md','txt','vue','svelte','dart','lua','r'];
  if (codeExts.includes(ext)) return 'code';
  return 'other';
}

export async function urlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const res = await fetch(url);
    return res.blob();
  }
  const res = await fetch(url);
  return res.blob();
}
