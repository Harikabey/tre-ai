// ============== Tre Veri Dışa/İçe Aktarma (IndexedDB <-> JSON) ==============

interface DbDescriptor {
  name: string;
  store: string;
  keyPath: string | null; // null => out-of-line keys (put(value, key))
}

const DATABASES: DbDescriptor[] = [
  { name: 'tre_generated_items', store: 'items', keyPath: 'id' },
  { name: 'tre_message_cache', store: 'messages', keyPath: 'id' },
  { name: 'tre_starred_messages', store: 'starred', keyPath: 'messageId' },
  { name: 'tre_chat_locks', store: 'locks', keyPath: 'id' },
  { name: 'tre-push', store: 'auth', keyPath: null },
];

export const LAST_EXPORT_KEY = 'tre_last_export_timestamp';
export const EXPORT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 saat

export interface ExportPayload {
  app: 'tre';
  version: 1;
  exportedAt: string;
  databases: Record<string, { store: string; keyPath: string | null; records: unknown[] }>;
}

function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => {
      const db = req.result;
      // Eğer DB yeni oluşturulduysa (hiç store yok) boş say ve sil
      if (db.objectStoreNames.length === 0) {
        db.close();
        indexedDB.deleteDatabase(name);
        resolve(null);
        return;
      }
      resolve(db);
    };
    req.onerror = () => resolve(null);
  });
}

function readAll(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve([]);
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const out: unknown[] = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return resolve(out);
      // keyPath'siz store'lar için anahtarı da sakla
      out.push({ __key: cursor.key, __value: cursor.value });
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function exportAllData(): Promise<ExportPayload> {
  const databases: ExportPayload['databases'] = {};
  for (const d of DATABASES) {
    const db = await openExisting(d.name);
    if (!db) continue;
    try {
      const records = await readAll(db, d.store);
      databases[d.name] = { store: d.store, keyPath: d.keyPath, records };
    } finally {
      db.close();
    }
  }
  return {
    app: 'tre',
    version: 1,
    exportedAt: new Date().toISOString(),
    databases,
  };
}

export function getCooldownRemainingMs(): number {
  const last = Number(localStorage.getItem(LAST_EXPORT_KEY) || 0);
  if (!last) return 0;
  const remaining = EXPORT_COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

export function markExported() {
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
}

/** JSON'u indirir; mümkünse sistem paylaşım menüsünü, değilse mailto kullanır. */
export async function shareOrDownloadExport(payload: ExportPayload): Promise<'shared' | 'downloaded' | 'mailto'> {
  const json = JSON.stringify(payload);
  const fileName = `tre-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], fileName, { type: 'application/json' });

  // 1) Sistem paylaşım menüsü (mobil/masaüstü)
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string }) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: 'Tre Yedek Dosyası' });
        return 'shared';
      }
    } catch {
      // kullanıcı iptal ettiyse indirme moduna düşme
      return 'shared';
    }
  }

  // 2) Dosya indirme
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  // 3) Mailto (dosya boyutu küçükse e-posta taslağı da aç)
  if (json.length < 100_000) {
    const subject = encodeURIComponent('Tre Yedek Dosyası');
    const body = encodeURIComponent(
      'Tre yedek dosyan ektedir / indirilenler klasöründedir. Geri yüklemek için Ayarlar > Veri Yedekleme > İçe Aktar.'
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    return 'mailto';
  }
  return 'downloaded';
}

// ============== İçe Aktarma ==============

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function openFresh(desc: DbDescriptor): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(desc.name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(desc.store)) {
        if (desc.keyPath) db.createObjectStore(desc.store, { keyPath: desc.keyPath });
        else db.createObjectStore(desc.store);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function writeAll(db: IDBDatabase, desc: DbDescriptor, records: { __key: IDBValidKey; __value: unknown }[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(desc.store, 'readwrite');
    const store = tx.objectStore(desc.store);
    for (const r of records) {
      if (desc.keyPath) store.put(r.__value);
      else store.put(r.__value, r.__key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** JSON yedeğini tüm IndexedDB veritabanlarının üzerine yazar. */
export async function importAllData(payload: ExportPayload): Promise<{ imported: string[] }> {
  if (!payload || payload.app !== 'tre' || !payload.databases) {
    throw new Error('Geçersiz yedek dosyası.');
  }
  const imported: string[] = [];
  for (const desc of DATABASES) {
    const dump = payload.databases[desc.name];
    // Önce mevcut veritabanını tamamen sil (overwrite)
    await deleteDatabase(desc.name);
    if (!dump || !Array.isArray(dump.records)) continue;
    const db = await openFresh(desc);
    try {
      await writeAll(db, desc, dump.records as { __key: IDBValidKey; __value: unknown }[]);
      imported.push(desc.name);
    } finally {
      db.close();
    }
  }
  return { imported };
}

export function parseExportFile(text: string): ExportPayload {
  const data = JSON.parse(text);
  if (!data || data.app !== 'tre') throw new Error('Bu dosya bir Tre yedeği değil.');
  return data as ExportPayload;
}
