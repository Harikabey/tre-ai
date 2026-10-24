// FILE: src/hooks/useWebGPU.ts
import { useMemo } from 'react';

export interface WebGPUStatus {
  isSupported: boolean;
  browserName: string;
  errorMessage: string | null;
}

const getBrowserName = (): string => {
  if (typeof navigator === 'undefined') return 'Bilinmeyen';

  const userAgent = navigator.userAgent;
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Chrome\//i.test(userAgent)) return 'Chrome';
  if (/Safari\//i.test(userAgent)) return 'Safari';
  return 'Bilinmeyen';
};

export function detectWebGPU(): WebGPUStatus {
  const browserName = getBrowserName();
  const isSupported = typeof navigator !== 'undefined' && 'gpu' in navigator &&
    navigator.gpu !== undefined;

  return {
    isSupported,
    browserName,
    errorMessage: isSupported
      ? null
      : 'Tarayıcınız WebGPU desteklemiyor. Yerel motor için Chrome 113+ veya Edge 113+ kullanın.',
  };
}

export function useWebGPU(): WebGPUStatus {
  return useMemo(detectWebGPU, []);
}
