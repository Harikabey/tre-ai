// FILE: src/hooks/useLocalModel.ts
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { MLCEngine } from '@mlc-ai/web-llm';
import { detectWebGPU } from '@/hooks/useWebGPU';
import { readModelSelection } from '@/hooks/useModelSelection';

export interface LocalChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LocalModelState {
  selectedModelId: LocalModelId;
  isLoading: boolean;
  progress: number;
  isReady: boolean;
  error: string | null;
  isCacheChecking: boolean;
  isModelCached: boolean | null;
  isLoadingFromCache: boolean;
  cacheError: string | null;
}

export const LOCAL_MODELS = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B (Hafif)',
    size: '~712 MB',
    description: 'Hızlı yüklenir, temel sohbet.',
  },
  {
    id: 'Qwen3-0.6B-q4f16_1-MLC',
    name: 'Qwen3 0.6B (Görsel/Genel - Hafif)',
    size: '~350 MB',
    description: 'Çok hızlı, basit görevler için hafif bir metin modeli.',
  },
  {
    id: 'Qwen3-4B-q4f16_1-MLC',
    name: 'Qwen3 4B (Güçlü)',
    size: '~2.2 GB',
    description: 'En iyi kalite, ancak cihazda daha fazla kaynak kullanır.',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B (Dengeli)',
    size: '~1.76 GB',
    description: 'Kalite ve hız arasında dengeli bir seçenek.',
  },
] as const;

export type LocalModelId = (typeof LOCAL_MODELS)[number]['id'];

const MODEL_SELECTION_KEY = 'tre_local_model_id';
const DEFAULT_MODEL_ID: LocalModelId = LOCAL_MODELS[0].id;

function isLocalModelId(value: unknown): value is LocalModelId {
  return LOCAL_MODELS.some((model) => model.id === value);
}

function readSelectedModelId(): LocalModelId {
  try {
    const storedModelId = localStorage.getItem(MODEL_SELECTION_KEY);
    return isLocalModelId(storedModelId) ? storedModelId : DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

const INITIAL_STATE: LocalModelState = {
  selectedModelId: readSelectedModelId(),
  isLoading: false,
  progress: 0,
  isReady: false,
  error: null,
  isCacheChecking: false,
  isModelCached: null,
  isLoadingFromCache: false,
  cacheError: null,
};

let state = INITIAL_STATE;
let engine: MLCEngine | null = null;
let activeModelId: LocalModelId | null = null;
let loadPromise: Promise<void> | null = null;
const cacheCheckPromises = new Map<LocalModelId, Promise<boolean | null>>();
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const updateState = (updates: Partial<LocalModelState>) => {
  state = { ...state, ...updates };
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;

async function loadModel(modelId: LocalModelId = state.selectedModelId): Promise<void> {
  if (state.selectedModelId !== modelId) {
    try {
      localStorage.setItem(MODEL_SELECTION_KEY, modelId);
    } catch (error) {
      const message = error instanceof Error
        ? `Model tercihi kaydedilemedi: ${error.message}`
        : 'Model tercihi kaydedilemedi.';
      updateState({ error: message });
      throw new Error(message);
    }

    updateState({
      selectedModelId: modelId,
      isReady: engine !== null && activeModelId === modelId,
      isLoading: false,
      progress: 0,
      error: null,
      isModelCached: null,
      isCacheChecking: false,
      cacheError: null,
    });
  }

  if (engine && activeModelId === modelId) {
    updateState({ isReady: true, isLoading: false, progress: 100, error: null });
    return;
  }

  const isModelCached = state.isModelCached ??
    await checkModelCache(modelId) ??
    false;

  if (loadPromise) {
    await loadPromise;
    if (engine && activeModelId === modelId) return;
  }

  const gpuStatus = detectWebGPU();
  if (!gpuStatus.isSupported) {
    const error = gpuStatus.errorMessage ?? 'Tarayıcınız WebGPU desteklemiyor.';
    updateState({ error });
    throw new Error(error);
  }

  updateState({
    isLoading: true,
    progress: 0,
    error: null,
    isLoadingFromCache: isModelCached,
  });
  loadPromise = (async () => {
    try {
      const gpu = (navigator as Navigator & {
        gpu?: { requestAdapter: () => Promise<unknown | null> };
      }).gpu;
      if (!gpu || !(await gpu.requestAdapter())) {
        throw new Error('Bu cihazda kullanılabilir bir WebGPU adaptörü bulunamadı.');
      }

      if (engine) {
        await engine.unload();
        engine = null;
        activeModelId = null;
      }

      const webllm = await import('@mlc-ai/web-llm');
      const loadedEngine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          const progressValue = report.progress <= 1
            ? report.progress * 100
            : report.progress;
          if (state.selectedModelId === modelId) {
            updateState({ progress: Math.min(100, Math.max(0, Math.round(progressValue))) });
          }
        },
      });
      engine = loadedEngine;
      activeModelId = modelId;
      if (state.selectedModelId === modelId) {
        updateState({
          isLoading: false,
          isLoadingFromCache: false,
          progress: 100,
          isReady: true,
          error: null,
        });
      }
    } catch (error) {
      const message = error instanceof Error
        ? `Yerel model yüklenemedi: ${error.message}`
        : 'Yerel model yüklenemedi.';
      if (state.selectedModelId === modelId) {
        updateState({ isLoading: false, isLoadingFromCache: false, error: message });
      }
      throw new Error(message);
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function checkModelCache(modelId: LocalModelId = state.selectedModelId): Promise<boolean | null> {
  const existingCheck = cacheCheckPromises.get(modelId);
  if (existingCheck) return existingCheck;

  if (state.selectedModelId === modelId) {
    updateState({ isCacheChecking: true, cacheError: null });
  }
  const checkPromise = (async (): Promise<boolean | null> => {
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const isModelCached = await webllm.hasModelInCache(modelId);
      if (state.selectedModelId === modelId) {
        updateState({ isCacheChecking: false, isModelCached });
      }
      return isModelCached;
    } catch (error) {
      const message = error instanceof Error
        ? `Model önbelleği kontrol edilemedi: ${error.message}`
        : 'Model önbelleği kontrol edilemedi.';
      if (state.selectedModelId === modelId) {
        updateState({
          isCacheChecking: false,
          isModelCached: null,
          cacheError: message,
        });
      }
      return null;
    }
  })();

  cacheCheckPromises.set(modelId, checkPromise);
  void checkPromise.then(() => cacheCheckPromises.delete(modelId));
  return checkPromise;
}

async function clearCacheAndReloadModel(): Promise<void> {
  updateState({
    isLoading: true,
    progress: 0,
    isReady: false,
    isLoadingFromCache: false,
    error: null,
  });

  try {
    const webllm = await import('@mlc-ai/web-llm');
    if (engine && activeModelId === state.selectedModelId) {
      await engine.unload();
      engine = null;
      activeModelId = null;
    }
    await webllm.deleteModelAllInfoInCache(state.selectedModelId);
  } catch (error) {
    const message = error instanceof Error
      ? `Model önbelleği temizlenemedi: ${error.message}`
      : 'Model önbelleği temizlenemedi.';
    updateState({ isLoading: false, error: message });
    throw new Error(message);
  }

  updateState({ isModelCached: false, cacheError: null, isReady: false });
  await loadModel(state.selectedModelId);
}

async function generateResponse(messages: LocalChatMessage[]): Promise<string> {
  if (!engine || activeModelId !== state.selectedModelId) {
    throw new Error('Yerel model henüz yüklenmedi. Lütfen Ayarlar’dan modeli indirin.');
  }

  const response = await engine.chat.completions.create({
    messages,
    stream: false,
    temperature: 0.7,
    max_tokens: 1024,
  });
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error('Yerel model boş yanıt verdi.');
  return content;
}

export function useLocalModel() {
  const modelState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    let isMounted = true;
    void checkModelCache().then((isCached) => {
      if (isMounted && isCached && readModelSelection().provider === 'local') {
        void loadModel().catch((error: unknown) => {
          console.error('Önbellekteki yerel model yüklenemedi:', error);
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const load = useCallback(async () => {
    const selectedModelId = state.selectedModelId;
    await loadModel(selectedModelId);
  }, []);
  const download = useCallback(async (modelId: LocalModelId) => {
    await loadModel(modelId);
  }, []);
  const reload = useCallback(() => clearCacheAndReloadModel(), []);
  const generate = useCallback((messages: LocalChatMessage[]) => generateResponse(messages), []);

  return {
    ...modelState,
    loadModel: load,
    downloadModel: download,
    clearCacheAndReloadModel: reload,
    generateResponse: generate,
  };
}
