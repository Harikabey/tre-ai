import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { VOICE_SETTINGS_KEY } from '@/types/voice';

export const useVoice = () => {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('EXAVITQu4vr4xnSDxMaL');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (stored) {
      setSelectedVoiceId(stored);
    }
  }, []);

  const updateVoice = useCallback((voiceId: string) => {
    setSelectedVoiceId(voiceId);
    localStorage.setItem(VOICE_SETTINGS_KEY, voiceId);
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playText = useCallback(async (text: string, voiceId?: string) => {
    if (isLoading) return;
    
    // Stop any currently playing audio
    stopAudio();

    if (!text.trim()) {
      toast.error('Okunacak metin yok');
      return;
    }

    // Remove markdown links and clean up text
    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .trim();

    if (!cleanText) {
      toast.error('Okunacak metin yok');
      return;
    }

    setIsLoading(true);

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            text: cleanText.substring(0, 5000), // Limit text length
            voiceId: voiceId || selectedVoiceId 
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Ses oluşturulamadı');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        toast.error('Ses oynatılamadı');
        audioRef.current = null;
      };

      setIsPlaying(true);
      await audio.play();
    } catch (error) {
      console.error('TTS error:', error);
      toast.error('Sesli okuma başarısız oldu');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, selectedVoiceId, stopAudio]);

  return {
    selectedVoiceId,
    updateVoice,
    playText,
    stopAudio,
    isPlaying,
    isLoading,
  };
};
