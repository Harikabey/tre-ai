import { useCallback, useEffect, useState } from 'react';
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
