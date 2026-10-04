const DATABASE_NAME = 'tre-shared-files';
const DATABASE_VERSION = 1;
const STORE_NAME = 'shared_files';
export const MAX_SHARED_FILE_SIZE = 10 * 1024 * 1024;

export interface SharedFileRecord {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  createdAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Paylaşılan dosya veritabanı açılamadı.'));
    request.onblocked = () => reject(new Error('Paylaşılan dosya veritabanı başka bir sekmede açık.'));
  });
}

async function withDatabase<T>(
  operation: (database: IDBDatabase) => Promise<T>,
): Promise<T> {
  const resetDatabase = () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Bozuk paylaşılan dosya veritabanı sıfırlanamadı.'));
    request.onblocked = () => reject(new Error('Bozuk paylaşılan dosya veritabanı sıfırlanamadı.'));
  });

  let database: IDBDatabase;
  try {
    database = await openDatabase();
  } catch {
    await resetDatabase();
    database = await openDatabase();
  }

  try {
    return await operation(database);
  } catch (error) {
    const recoverable = error instanceof DOMException &&
      ['InvalidStateError', 'NotFoundError', 'UnknownError'].includes(error.name);
    if (!recoverable) throw error;
    database.close();
    await resetDatabase();
    const recoveredDatabase = await openDatabase();
    try {
      return await operation(recoveredDatabase);
    } finally {
      recoveredDatabase.close();
    }
  } finally {
    database.close();
  }
}

function runRequest<T>(database: IDBDatabase, createRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = createRequest(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Paylaşılan dosya verisi okunamadı.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Paylaşılan dosya işlemi tamamlanamadı.'));
  });
}

export async function saveSharedFile(file: File): Promise<SharedFileRecord> {
  if (file.size > MAX_SHARED_FILE_SIZE) {
    throw new Error('Dosya boyutu 10 MB sınırını aşıyor.');
  }
  if (typeof indexedDB === 'undefined') {
    throw new Error('Bu tarayıcı yerel dosya paylaşımını desteklemiyor.');
  }

  const record: SharedFileRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    name: file.name,
    type: file.type,
    size: file.size,
    createdAt: Date.now(),
  };
  await withDatabase((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Dosya kaydedilemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Dosya kaydedilemedi.'));
  }));
  return record;
}

export async function getSharedFiles(): Promise<SharedFileRecord[]> {
  if (typeof indexedDB === 'undefined') return [];
  const records = await withDatabase((database) =>
    runRequest<SharedFileRecord[]>(database, (store) => store.getAll()),
  );
  return records.filter((record) => record?.file instanceof File);
}

export async function clearSharedFiles(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await withDatabase((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Paylaşılan dosyalar temizlenemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Paylaşılan dosyalar temizlenemedi.'));
  }));
}

export async function deleteSharedFile(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await withDatabase((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Paylaşılan dosya silinemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Paylaşılan dosya silinemedi.'));
  }));
}
