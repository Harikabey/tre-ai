// FILE: src/hooks/useModelSelection.ts
import { useCallback, useEffect, useState } from 'react';

export type ModelProvider = 'default' | 'byok' | 'local';
export type ApiProvider = 'groq' | 'openrouter';

export interface ModelSelection {
  provider: ModelProvider;
  apiKey: string;
  apiProvider: ApiProvider;
}

export const MODEL_SELECTION_KEY = 'tre_model_selection';

const DEFAULT_SELECTION: ModelSelection = {
  provider: 'default',
  apiKey: '',
  apiProvider: 'groq',
};

const isModelProvider = (value: unknown): value is ModelProvider =>
  value === 'default' || value === 'byok' || value === 'local';

const isApiProvider = (value: unknown): value is ApiProvider =>
  value === 'groq' || value === 'openrouter';

export function readModelSelection(): ModelSelection {
  try {
    const storedValue = localStorage.getItem(MODEL_SELECTION_KEY);
    if (!storedValue) return DEFAULT_SELECTION;

    const parsed: unknown = JSON.parse(storedValue);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SELECTION;

    const selection = parsed as Record<string, unknown>;
    if (
      !isModelProvider(selection.provider) ||
      typeof selection.apiKey !== 'string' ||
      !isApiProvider(selection.apiProvider)
    ) {
      return DEFAULT_SELECTION;
    }

    return {
      provider: selection.provider,
      apiKey: selection.apiKey,
      apiProvider: selection.apiProvider,
    };
  } catch {
    return DEFAULT_SELECTION;
  }
}

export function useModelSelection() {
  const [selection, setSelection] = useState<ModelSelection>(readModelSelection);

  useEffect(() => {
    localStorage.setItem(MODEL_SELECTION_KEY, JSON.stringify(selection));
  }, [selection]);

  const setProvider = useCallback((provider: ModelProvider) => {
    setSelection((current) => ({ ...current, provider }));
  }, []);

  const setApiKey = useCallback((apiKey: string) => {
    setSelection((current) => ({ ...current, apiKey }));
  }, []);

  const setApiProvider = useCallback((apiProvider: ApiProvider) => {
    setSelection((current) => ({ ...current, apiProvider }));
  }, []);

  return {
    ...selection,
    setProvider,
    setApiKey,
    setApiProvider,
    isConfigured: selection.provider === 'default' ||
      (selection.provider === 'byok' && selection.apiKey.trim().length > 0),
  };
}
