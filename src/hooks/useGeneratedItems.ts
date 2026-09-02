import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  GeneratedItem,
  GeneratedItemKind,
  addItem as dbAdd,
  clearItems as dbClear,
  deleteItem as dbDelete,
  listItems,
  renameItem as dbRename,
  kindFromMimeOrName,
  urlToBlob,
} from '@/lib/generatedItemsDb';

export type { GeneratedItem, GeneratedItemKind };

/** localStorage flag: when 'true', generated files are also synced to cloud storage. */
export const CLOUD_FILES_KEY = 'tre_cloud_files_enabled';
export const isCloudFilesEnabled = () => localStorage.getItem(CLOUD_FILES_KEY) === 'true';

/** Best-effort upload to the private attachments bucket (only when the toggle is ON). */
async function syncToCloud(name: string, blob: Blob) {
  if (!isCloudFilesEnabled()) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const safe = name.replace(/[^\w.\-]/g, '_');
    await supabase.storage
      .from('chat-attachments')
      .upload(`${uid}/generated/${Date.now()}-${safe}`, blob, {
        contentType: blob.type || 'application/octet-stream',
        upsert: false,
      });
  } catch (e) {
    console.warn('cloud sync skipped:', e);
  }
}

export const useGeneratedItems = () => {
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await listItems();
    setItems(all);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const addFromBlob = useCallback(async (params: {
    name: string;
    blob: Blob;
    prompt?: string;
    kind?: GeneratedItemKind;
  }) => {
    const kind = params.kind || kindFromMimeOrName(params.blob.type || '', params.name);
    const item = await dbAdd({
      name: params.name,
      blob: params.blob,
      mimeType: params.blob.type || 'application/octet-stream',
      prompt: params.prompt,
      kind,
    });
    setItems((prev) => [item, ...prev]);
    syncToCloud(params.name, params.blob);
    return item;
  }, []);

  const addFromUrl = useCallback(async (params: {
    url: string;
    name: string;
    prompt?: string;
    kind?: GeneratedItemKind;
  }) => {
    try {
      const blob = await urlToBlob(params.url);
      return await addFromBlob({ name: params.name, blob, prompt: params.prompt, kind: params.kind });
    } catch (e) {
      console.error('addFromUrl failed:', e);
      return null;
    }
  }, [addFromBlob]);

  const addFromText = useCallback(async (params: {
    name: string;
    content: string;
    mimeType?: string;
    prompt?: string;
  }) => {
    const blob = new Blob([params.content], { type: params.mimeType || 'text/plain' });
    return addFromBlob({ name: params.name, blob, prompt: params.prompt });
  }, [addFromBlob]);

  const remove = useCallback(async (id: string) => {
    await dbDelete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const rename = useCallback(async (id: string, newName: string) => {
    await dbRename(id, newName);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, name: newName } : i)));
  }, []);

  const clear = useCallback(async () => {
    await dbClear();
    setItems([]);
  }, []);

  return { items, loading, addFromBlob, addFromUrl, addFromText, remove, rename, clear, refresh };
};
