import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface Note {
  step: number;
  pitch: number;
  duration: number;
}

export const useMelodySpeech = (bpm: number) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef(new Set<AudioScheduledSourceNode>());
  const playbackIdRef = useRef(0);
  const isSynthesizingRef = useRef(false);

  const stop = useCallback(() => {
    playbackIdRef.current += 1;
    activeSourcesRef.current.forEach((source) => source.stop());
    activeSourcesRef.current.clear();
    setIsPlaying(false);
  }, []);

  useEffect(() => () => {
    activeSourcesRef.current.forEach((source) => source.stop());
    activeSourcesRef.current.clear();
    if (contextRef.current && contextRef.current.state !== 'closed') {
      void contextRef.current.close();
    }
  }, []);

  const synthesizeAndPlay = useCallback(async (sozler: string, melodyNotes: Note[]) => {
    const text = sozler.trim();
    if (!text) {
      toast.error('Lütfen önce şarkı sözlerini yazın.');
      return;
    }
    if (text.length > 5000) {
      toast.error('Şarkı sözleri 5000 karakteri aşamaz.');
      return;
    }
    if (isSynthesizingRef.current) return;
    if (melodyNotes.length === 0) {
      toast.error('Seçilen melodide nota yok. Önce Piyano Rulosu’na nota ekleyin.');
      return;
    }
    if (!Number.isFinite(bpm) || bpm <= 0) {
      toast.error('Melodi temposu geçerli değil.');
      return;
    }

    isSynthesizingRef.current = true;
    setIsLoading(true);
    stop();

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error('Seslendirmek için giriş yapmalısınız.');

      const context = contextRef.current ?? new AudioContext({ latencyHint: 'interactive' });
      contextRef.current = context;
      if (context.state === 'suspended') await context.resume();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorBody: unknown = await response.json();
          if (
            typeof errorBody === 'object' &&
            errorBody !== null &&
            'error' in errorBody &&
            typeof errorBody.error === 'string'
          ) {
            errorMessage = errorBody.error;
          }
        } catch {
          errorMessage = '';
        }
        if (errorMessage.includes('ELEVENLABS_API_KEY')) {
          throw new Error('ElevenLabs API anahtarı sunucuya tanımlı değil.');
        }
        if (errorMessage.includes('Invalid or expired token')) {
          throw new Error('Oturum süresi dolmuş. Lütfen yeniden giriş yapın.');
        }
        const apiError = errorMessage.match(/ElevenLabs API error: (\d+)/);
        if (apiError) {
          throw new Error(apiError[1] === '401'
            ? 'ElevenLabs API anahtarı geçersiz veya süresi dolmuş.'
            : `ElevenLabs ses isteği başarısız oldu (HTTP ${apiError[1]}).`);
        }
        throw new Error(errorMessage || `ElevenLabs ses üretimi başarısız oldu (${response.status}).`);
      }

      const audioBuffer = await context.decodeAudioData(await response.arrayBuffer());
      const stepDuration = 60 / bpm / 4;
      const melodyDuration = Math.max(
        ...melodyNotes.map((note) => (note.step + note.duration) * stepDuration),
      );

      if (audioBuffer.duration > melodyDuration) {
        toast.error('Sözler melodiye çok uzun.');
        return;
      }

      const playbackId = ++playbackIdRef.current;
      const startAt = context.currentTime + 0.05;
      const trackSource = (source: AudioScheduledSourceNode) => {
        activeSourcesRef.current.add(source);
        source.onended = () => {
          activeSourcesRef.current.delete(source);
          if (playbackIdRef.current === playbackId && activeSourcesRef.current.size === 0) {
            setIsPlaying(false);
          }
        };
      };

      const vocalSource = context.createBufferSource();
      vocalSource.buffer = audioBuffer;
      const vocalGain = context.createGain();
      vocalGain.gain.value = 0.85;
      vocalSource.connect(vocalGain);
      vocalGain.connect(context.destination);
      trackSource(vocalSource);
      vocalSource.start(startAt);

      melodyNotes.forEach((note) => {
        const noteStart = startAt + note.step * stepDuration;
        const noteEnd = noteStart + note.duration * stepDuration;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);
        gain.gain.setValueAtTime(0.24, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);
        oscillator.connect(gain);
        gain.connect(context.destination);
        trackSource(oscillator);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd);
      });

      setIsPlaying(true);
    } catch (error) {
      console.error('Melody speech error:', error);
      toast.error(error instanceof Error ? error.message : 'Sözler seslendirilemedi.');
    } finally {
      isSynthesizingRef.current = false;
      setIsLoading(false);
    }
  }, [bpm, stop]);

  return { synthesizeAndPlay, stop, isLoading, isPlaying };
};
