import { useEffect, useState } from 'react';

export interface SystemCapabilities {
  checking: boolean;
  wasm: boolean;
  cacheApi: boolean;
  storageApi: boolean;
  storageFreeBytes: number | null;
  memoryGb: number | null;
  error: string | null;
}

const EMPTY_CAPABILITIES: SystemCapabilities = {
  checking: true,
  wasm: false,
  cacheApi: false,
  storageApi: false,
  storageFreeBytes: null,
  memoryGb: null,
  error: null,
};

export const useSystemCapabilities = (): SystemCapabilities => {
  const [capabilities, setCapabilities] = useState(EMPTY_CAPABILITIES);

  useEffect(() => {
    let active = true;

    const checkCapabilities = async () => {
      const wasm = typeof WebAssembly !== 'undefined'
        && WebAssembly.validate(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
      const cacheApi = typeof caches !== 'undefined';
      const storage = navigator.storage;
      const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null;

      if (!storage?.estimate) {
        if (active) {
          setCapabilities({
            checking: false,
            wasm,
            cacheApi,
            storageApi: false,
            storageFreeBytes: null,
            memoryGb,
            error: null,
          });
        }
        return;
      }

      try {
        const estimate = await storage.estimate();
        const storageFreeBytes = estimate.quota === undefined
          ? null
          : Math.max(0, estimate.quota - (estimate.usage ?? 0));
        if (active) {
          setCapabilities({
            checking: false,
            wasm,
            cacheApi,
            storageApi: true,
            storageFreeBytes,
            memoryGb,
            error: null,
          });
        }
      } catch (error) {
        if (active) {
          setCapabilities({
            checking: false,
            wasm,
            cacheApi,
            storageApi: false,
            storageFreeBytes: null,
            memoryGb,
            error: error instanceof Error ? error.message : 'Depolama alanı kontrol edilemedi.',
          });
        }
      }
    };

    void checkCapabilities();
    return () => { active = false; };
  }, []);

  return capabilities;
};
