import { decode, encode } from '@jsquash/jpeg';

interface ProcessRequest {
  id: number;
  buffer: ArrayBuffer;
}

interface ProcessSuccess {
  id: number;
  buffer: ArrayBuffer;
}

interface ProcessFailure {
  id: number;
  error: string;
}

self.onmessage = async (event: MessageEvent<ProcessRequest>) => {
  const { id, buffer } = event.data;
  try {
    const imageData = await decode(buffer);
    const output = await encode(imageData, { quality: 80 });
    const result: ProcessSuccess = { id, buffer: output };
    self.postMessage(result, { transfer: [output] });
  } catch (error) {
    const result: ProcessFailure = {
      id,
      error: error instanceof Error ? error.message : 'Görsel işlenemedi.',
    };
    self.postMessage(result);
  }
};
