import { useCallback, useEffect, useState } from 'react';

export const CHAT_BACKGROUND_KEY = 'tre_chat_background';
const CHAT_BACKGROUND_EVENT = 'tre-chat-background-changed';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

export class ChatBackgroundError extends Error {
  constructor(
    message: string,
    public readonly code: 'too-large' | 'invalid-image' | 'storage' | 'quota'
  ) {
    super(message);
    this.name = 'ChatBackgroundError';
  }
}

function readBackground(): string | null {
  try {
    const saved = localStorage.getItem(CHAT_BACKGROUND_KEY);
    if (saved) return saved;

    const previousValue = localStorage.getItem('chatBg');
    if (!previousValue) return null;
    localStorage.setItem(CHAT_BACKGROUND_KEY, previousValue);
    localStorage.removeItem('chatBg');
    return previousValue;
  } catch {
    return null;
  }
}

function dispatchBackgroundChange(backgroundImage: string | null): void {
  window.dispatchEvent(
    new CustomEvent<string | null>(CHAT_BACKGROUND_EVENT, { detail: backgroundImage })
  );
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ChatBackgroundError('Görsel yüklenemedi.', 'invalid-image'));
    image.src = source;
  });
}

async function resizeImage(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ChatBackgroundError('Görsel 2 MB’dan büyük olamaz.', 'too-large');
  }
  if (!file.type.startsWith('image/')) {
    throw new ChatBackgroundError('Geçerli bir görsel seçin.', 'invalid-image');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new ChatBackgroundError('Geçerli bir görsel seçin.', 'invalid-image');
    }

    const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new ChatBackgroundError('Görsel işlenemedi.', 'invalid-image');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (error) {
    if (error instanceof ChatBackgroundError) throw error;
    throw new ChatBackgroundError('Görsel yüklenirken hata oluştu.', 'invalid-image');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function validateImageUrl(value: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ChatBackgroundError('Geçerli bir görsel URL’si girin.', 'invalid-image');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ChatBackgroundError('Geçerli bir görsel URL’si girin.', 'invalid-image');
  }

  await loadImage(parsed.href);
  return parsed.href;
}

export function useChatBackground() {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(readBackground);

  useEffect(() => {
    const onBackgroundChange = (event: Event) => {
      const customEvent = event as CustomEvent<string | null>;
      setBackgroundImage(customEvent.detail);
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === CHAT_BACKGROUND_KEY) setBackgroundImage(event.newValue);
    };

    window.addEventListener(CHAT_BACKGROUND_EVENT, onBackgroundChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener(CHAT_BACKGROUND_EVENT, onBackgroundChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  const setBackground = useCallback(async (source: File | string): Promise<void> => {
    const value = typeof source === 'string'
      ? await validateImageUrl(source)
      : await resizeImage(source);

    try {
      localStorage.setItem(CHAT_BACKGROUND_KEY, value);
    } catch (error) {
      if (error instanceof DOMException && (
        error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        try {
          localStorage.removeItem(CHAT_BACKGROUND_KEY);
          dispatchBackgroundChange(null);
        } catch {
          throw new ChatBackgroundError('Depolama alanı kullanılamıyor.', 'storage');
        }
        throw new ChatBackgroundError('Depolama alanı dolu; eski arka plan kaldırıldı.', 'quota');
      }
      throw new ChatBackgroundError('Görsel kaydedilemedi.', 'storage');
    }

    dispatchBackgroundChange(value);
  }, []);

  const clearBackground = useCallback((): void => {
    try {
      localStorage.removeItem(CHAT_BACKGROUND_KEY);
    } catch {
      throw new ChatBackgroundError('Arka plan kaldırılamadı.', 'storage');
    }
    dispatchBackgroundChange(null);
  }, []);

  return { backgroundImage, setBackground, clearBackground };
}
