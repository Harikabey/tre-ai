// FILE: src/hooks/useLocalModel.ts
import { useCallback, useSyncExternalStore } from 'react';
import type { MLCEngine } from '@mlc-ai/web-llm';
import { detectWebGPU } from '@/hooks/useWebGPU';

export interface LocalChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LocalModelState {
  isLoading: boolean;
  progress: number;
  isReady: boolean;
  error: string | null;
}

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const INITIAL_STATE: LocalModelState = {
  isLoading: false,
  progress: 0,
  isReady: false,
  error: null,
};

let state = INITIAL_STATE;
let engine: MLCEngine | null = null;
let loadPromise: Promise<void> | null = null;
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

async function loadModel(): Promise<void> {
  if (engine) return;
  if (loadPromise) return loadPromise;

  const gpuStatus = detectWebGPU();
  if (!gpuStatus.isSupported) {
    const error = gpuStatus.errorMessage ?? 'Tarayıcınız WebGPU desteklemiyor.';
    updateState({ error });
    throw new Error(error);
  }

  updateState({ isLoading: true, progress: 0, error: null });
  loadPromise = (async () => {
    try {
      const gpu = navigator.gpu;
      if (!gpu || !(await gpu.requestAdapter())) {
        throw new Error('Bu cihazda kullanılabilir bir WebGPU adaptörü bulunamadı.');
      }

      const webllm = await import('@mlc-ai/web-llm');
      const loadedEngine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          const progressValue = report.progress <= 1
            ? report.progress * 100
            : report.progress;
          updateState({ progress: Math.min(100, Math.max(0, Math.round(progressValue))) });
        },
      });
      engine = loadedEngine;
      updateState({ isLoading: false, progress: 100, isReady: true, error: null });
    } catch (error) {
      const message = error instanceof Error
        ? `Yerel model yüklenemedi: ${error.message}`
        : 'Yerel model yüklenemedi.';
      updateState({ isLoading: false, error: message });
      throw new Error(message);
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

async function generateResponse(messages: LocalChatMessage[]): Promise<string> {
  if (!engine) {
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
  const load = useCallback(() => loadModel(), []);
  const generate = useCallback((messages: LocalChatMessage[]) => generateResponse(messages), []);

  return {
    ...modelState,
    loadModel: load,
    generateResponse: generate,
  };
}
