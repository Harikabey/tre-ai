import { useCallback, useEffect, useRef, useState } from 'react';
import { ASR } from '@siteed/sherpa-onnx.rn';
import { toast } from 'sonner';

const MODEL_CONFIG = {
  modelDir: '/models/seda-v0.2-tiny/',
  modelType: 'zipformer2',
  streaming: true,
  modelBaseUrl: '/models/seda-v0.2-tiny/',
  modelFiles: {
    encoder: 'encoder.int8.onnx',
    decoder: 'decoder.onnx',
    joiner: 'joiner.int8.onnx',
    tokens: 'tokens.txt',
  },
} as const;

const TARGET_SAMPLE_RATE = 16000;

const resampleAudio = (samples: Float32Array, sampleRate: number): number[] => {
  if (sampleRate === TARGET_SAMPLE_RATE) return Array.from(samples);

  const ratio = sampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(samples.length / ratio);
  const output = new Array<number>(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const sourceIndex = Math.floor(sourcePosition);
    const fraction = sourcePosition - sourceIndex;
    const nextIndex = Math.min(sourceIndex + 1, samples.length - 1);
    output[index] = samples[sourceIndex] * (1 - fraction) + samples[nextIndex] * fraction;
  }

  return output;
};

export const useSeda = () => {
  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const initializedRef = useRef(false);
  const startingRef = useRef(false);
  const activeRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const processingQueueRef = useRef<Promise<void>>(Promise.resolve());

  const initializeModel = useCallback(async (): Promise<boolean> => {
    if (initializedRef.current) return true;

    try {
      const result = await ASR.initialize(MODEL_CONFIG);
      if (!result.success) {
        throw new Error(result.error ?? 'ASR.initialize başarısız oldu');
      }
      initializedRef.current = true;
      return true;
    } catch (error: unknown) {
      console.error('Seda modeli yüklenemedi:', error);
      toast.error('Seda modeli yüklenemedi');
      return false;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    activeRef.current = false;
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch((error: unknown) => {
        console.error('Seda ses bağlamı kapatılamadı:', error);
      });
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (!activeRef.current && !startingRef.current) return;

    cleanupAudio();
    setIsListening(false);

    try {
      await processingQueueRef.current;
      if (initializedRef.current) {
        const finished = await ASR.finishInput();
        if (!finished.success) {
          throw new Error(finished.error ?? 'Seda son ses verisini işleyemedi');
        }
        const result = await ASR.getResult();
        setTranscript(result.text);
      }
    } catch (error: unknown) {
      console.error('Seda akışı durdurulamadı:', error);
      toast.error('Seda ses akışı durdurulamadı');
    }
  }, [cleanupAudio]);

  const startListening = useCallback(async () => {
    if (activeRef.current || startingRef.current) return;
    startingRef.current = true;
    setIsStarting(true);
    setTranscript('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Tarayıcı mikrofon erişimini desteklemiyor');
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();

      if (!await initializeModel()) {
        cleanupAudio();
        return;
      }

      const onlineStream = await ASR.createOnlineStream();
      if (!onlineStream.success) {
        throw new Error('Seda çevrimiçi akışı oluşturulamadı');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      activeRef.current = true;
      setIsListening(true);

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!activeRef.current) return;
        const samples = resampleAudio(event.inputBuffer.getChannelData(0), audioContext.sampleRate);
        if (samples.length === 0) return;

        processingQueueRef.current = processingQueueRef.current
          .then(async () => {
            if (!activeRef.current) return;
            const accepted = await ASR.acceptWaveform(TARGET_SAMPLE_RATE, samples);
            if (!accepted.success) {
              throw new Error('Seda ses örnekleri kabul edilmedi');
            }
            const result = await ASR.getResult();
            if (activeRef.current) setTranscript(result.text);
          })
          .catch((error: unknown) => {
            console.error('Seda ses akışı hatası:', error);
            toast.error('Seda ses akışı başarısız oldu');
            cleanupAudio();
            setIsListening(false);
          });
      };
    } catch (error: unknown) {
      console.error('Mikrofon başlatılamadı:', error);
      toast.error('Mikrofon başlatılamadı');
      cleanupAudio();
    } finally {
      startingRef.current = false;
      setIsStarting(false);
    }
  }, [cleanupAudio, initializeModel]);

  useEffect(() => () => {
    cleanupAudio();
  }, [cleanupAudio]);

  return {
    isListening,
    isStarting,
    transcript,
    startListening,
    stopListening,
  };
};
