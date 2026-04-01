import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/hooks/useVoice';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { ScreenShare, X, Loader2, AlertCircle, Volume2, VolumeX, Mic, MicOff, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LiveScreenShareViewProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (analysis: string, imageDataUrl: string) => void;
}

export const LiveScreenShareView = ({ isOpen, onClose, onAnalysisComplete }: LiveScreenShareViewProps) => {
  const { playText, stopAudio, isPlaying, isLoading: isVoiceLoading } = useVoice();
  const { isListening, transcript, isSupported: isSpeechSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentAnalysis, setCurrentAnalysis] = useState('');
  const [continuousMode, setContinuousMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const continuousIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        setError('Ekran paylaşımı bu ortamda desteklenmiyor. Lütfen uygulamayı doğrudan tarayıcıda açın (yayınlanmış URL kullanın).');
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5, max: 10 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);

      // Listen for when user stops sharing via browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopStream();
        toast.info('Ekran paylaşımı durduruldu');
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Ekran paylaşımı izni reddedildi.');
      } else {
        setError('Ekran paylaşımı başlatılamadı. Lütfen uygulamayı doğrudan tarayıcıda açın.');
        console.error('Screen share error:', err);
      }
    }
  }, [stopStream]);

  const stopContinuousMode = useCallback(() => {
    if (continuousIntervalRef.current) {
      clearInterval(continuousIntervalRef.current);
      continuousIntervalRef.current = null;
    }
    setContinuousMode(false);
  }, []);

  // Start screen share when opened
  useEffect(() => {
    if (isOpen) {
      startScreenShare();
    } else {
      stopStream();
      stopAudio();
      stopContinuousMode();
      setCurrentAnalysis('');
      setError(null);
    }

    return () => {
      stopStream();
      stopAudio();
      stopContinuousMode();
    };
  }, [isOpen]);

  // Handle speech recognition transcript
  useEffect(() => {
    if (transcript && !isListening) {
      handleCaptureWithQuestion(transcript);
      resetTranscript();
    }
  }, [transcript, isListening]);

  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || !isActive || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7);
  }, [isActive]);

  const analyzeFrame = useCallback(async (question?: string): Promise<string | null> => {
    const dataUrl = await captureFrame();
    if (!dataUrl) return null;

    try {
      const prompt = question?.trim() || 'Bu ekran görüntüsünü analiz et ve gördüklerini kısaca açıkla. Önemli değişiklikleri veya dikkat çekici şeyleri belirt. Türkçe yanıt ver.';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageUrl: dataUrl, prompt }),
        }
      );

      if (!response.ok) throw new Error('Analiz başarısız');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data.analysis;
    } catch (err) {
      console.error('Analysis error:', err);
      return null;
    }
  }, [captureFrame]);

  const handleCaptureWithQuestion = async (question?: string) => {
    if (isAnalyzing || !isActive) return;

    setIsAnalyzing(true);

    try {
      const dataUrl = await captureFrame();
      if (!dataUrl) {
        toast.error('Ekran görüntüsü yakalanamadı');
        return;
      }

      const prompt = question?.trim() || 'Bu ekran görüntüsünü analiz et ve gördüklerini detaylı açıkla. Eğer yardım istenen bir durum varsa buna göre cevap ver. Türkçe yanıt ver.';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageUrl: dataUrl, prompt }),
        }
      );

      if (!response.ok) throw new Error('Analiz başarısız');
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const analysis = data.analysis;
      setCurrentAnalysis(analysis);

      if (voiceEnabled && analysis) {
        playText(analysis);
      }

      onAnalysisComplete(analysis, dataUrl);
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('Ekran analizi başarısız');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleContinuousMode = useCallback(() => {
    if (continuousMode) {
      stopContinuousMode();
      toast.info('Sürekli analiz durduruldu');
    } else {
      setContinuousMode(true);
      toast.success('Sürekli ekran analizi başladı');

      continuousIntervalRef.current = setInterval(async () => {
        if (!isAnalyzing && isActive) {
          const analysis = await analyzeFrame();
          if (analysis) {
            setCurrentAnalysis(analysis);
            if (voiceEnabled) {
              stopAudio();
              playText(analysis);
            }
          }
        }
      }, 5000);
    }
  }, [continuousMode, stopContinuousMode, isAnalyzing, isActive, analyzeFrame, voiceEnabled, stopAudio, playText]);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      stopAudio();
      resetTranscript();
      startListening();
      toast.info('Dinliyorum... Sorunuzu söyleyin');
    }
  }, [isListening, stopListening, startListening, stopAudio, resetTranscript]);

  const handleClose = useCallback(() => {
    stopStream();
    stopAudio();
    stopContinuousMode();
    onClose();
  }, [stopStream, stopAudio, stopContinuousMode, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ScreenShare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Canlı Ekran Paylaşımı</h2>
            {continuousMode && (
              <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full animate-pulse">
                Canlı
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Screen View */}
        <div className="flex-1 relative overflow-hidden bg-black">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" className="mt-4" onClick={startScreenShare}>
                Tekrar Dene
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "w-full h-full object-contain",
                  !isActive && "opacity-0"
                )}
              />
              {!isActive && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}

              {/* Voice input indicator */}
              {isListening && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                  <Mic className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {transcript || 'Dinleniyor...'}
                  </span>
                </div>
              )}

              {/* Overlay for analyzing */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                    <p>Analiz ediliyor...</p>
                  </div>
                </div>
              )}

              {/* Analysis result */}
              {currentAnalysis && !isAnalyzing && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 max-h-[40%] overflow-y-auto">
                  <div className="flex items-start gap-2">
                    {(isPlaying || isVoiceLoading) && (
                      <Volume2 className="w-5 h-5 text-primary animate-pulse flex-shrink-0 mt-1" />
                    )}
                    <p className="text-white text-sm leading-relaxed">{currentAnalysis}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 pb-safe border-t border-border/50">
          <div className="flex items-center justify-center gap-3">
            {/* Voice Input */}
            {isSpeechSupported && (
              <Button
                variant={isListening ? "default" : "outline"}
                size="icon"
                onClick={toggleVoiceInput}
                disabled={!isActive || isAnalyzing}
                className={cn("h-12 w-12", isListening && "bg-primary animate-pulse")}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            )}

            {/* Capture Button */}
            <Button
              variant="glow"
              size="lg"
              onClick={() => handleCaptureWithQuestion()}
              disabled={!isActive || isAnalyzing}
              className="h-16 w-16 rounded-full"
            >
              {isAnalyzing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ScreenShare className="w-6 h-6" />
              )}
            </Button>

            {/* Continuous Mode Toggle */}
            <Button
              variant={continuousMode ? "default" : "outline"}
              size="icon"
              onClick={toggleContinuousMode}
              disabled={!isActive}
              className={cn("h-12 w-12", continuousMode && "bg-primary hover:bg-primary/90")}
            >
              {continuousMode ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>

            {/* Voice Output Toggle */}
            <Button
              variant={voiceEnabled ? "outline" : "ghost"}
              size="icon"
              onClick={() => {
                if (isPlaying) stopAudio();
                setVoiceEnabled(!voiceEnabled);
              }}
              className={cn("h-12 w-12", !voiceEnabled && "opacity-50")}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-3">
            🎤 Sesli soru sorun • 🖥️ Tek kare • ▶️ Sürekli analiz
          </p>
          <p className="text-center text-xs text-muted-foreground mt-1 opacity-70">
            Not: Yayınlanmış URL üzerinden kullanın
          </p>
        </div>
      </div>
    </div>
  );
};
