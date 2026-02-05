import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { useVoice } from '@/hooks/useVoice';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Camera, X, RotateCcw, Loader2, AlertCircle, Volume2, VolumeX, Mic, MicOff, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LiveCameraViewProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (analysis: string, imageDataUrl: string) => void;
}

export const LiveCameraView = ({ isOpen, onClose, onAnalysisComplete }: LiveCameraViewProps) => {
  const { videoRef, isActive, isCapturing, error, startCamera, stopCamera, captureFrame, switchCamera } = useCamera();
  const { playText, stopAudio, isPlaying, isLoading: isVoiceLoading } = useVoice();
  const { isListening, transcript, isSupported: isSpeechSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentAnalysis, setCurrentAnalysis] = useState('');
  const [continuousMode, setContinuousMode] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const continuousIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start camera when opened
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      stopAudio();
      stopContinuousMode();
    }
    
    return () => {
      stopCamera();
      stopAudio();
      stopContinuousMode();
    };
  }, [isOpen, startCamera, stopCamera, stopAudio]);

  // Handle speech recognition transcript
  useEffect(() => {
    if (transcript && !isListening) {
      setPendingQuestion(transcript);
      // Auto-capture when speech ends
      handleCaptureWithQuestion(transcript);
      resetTranscript();
    }
  }, [transcript, isListening]);

  const stopContinuousMode = useCallback(() => {
    if (continuousIntervalRef.current) {
      clearInterval(continuousIntervalRef.current);
      continuousIntervalRef.current = null;
    }
    setContinuousMode(false);
  }, []);

  const analyzeFrame = useCallback(async (question?: string): Promise<string | null> => {
    const dataUrl = await captureFrame();
    if (!dataUrl) {
      return null;
    }

    try {
      const prompt = question?.trim() || 'Bu görüntüyü analiz et ve gördüklerini kısaca açıkla. Önemli değişiklikleri veya dikkat çekici şeyleri belirt. Türkçe yanıt ver.';
      
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

      if (!response.ok) {
        throw new Error('Analiz başarısız');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      return data.analysis;
    } catch (err) {
      console.error('Analysis error:', err);
      return null;
    }
  }, [captureFrame]);

  const handleCaptureWithQuestion = async (question?: string) => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    setPendingQuestion('');
    
    try {
      const dataUrl = await captureFrame();
      if (!dataUrl) {
        toast.error('Görüntü yakalanamadı');
        return;
      }

      const prompt = question?.trim() || 'Bu görüntüyü analiz et ve gördüklerini detaylı açıkla. Eğer yardım istenen bir durum varsa buna göre cevap ver. Türkçe yanıt ver.';
      
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

      if (!response.ok) {
        throw new Error('Analiz başarısız');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const analysis = data.analysis;
      setCurrentAnalysis(analysis);

      // Play voice response if enabled
      if (voiceEnabled && analysis) {
        playText(analysis);
      }

      onAnalysisComplete(analysis, dataUrl);
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('Görüntü analizi başarısız');
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
      toast.success('Sürekli analiz başladı');
      
      // Start continuous analysis every 5 seconds
      continuousIntervalRef.current = setInterval(async () => {
        if (!isAnalyzing && isActive) {
          const analysis = await analyzeFrame();
          if (analysis) {
            setCurrentAnalysis(analysis);
            if (voiceEnabled) {
              stopAudio(); // Stop previous audio
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
      stopAudio(); // Stop any playing audio
      resetTranscript();
      startListening();
      toast.info('Dinliyorum... Sorunuzu söyleyin');
    }
  }, [isListening, stopListening, startListening, stopAudio, resetTranscript]);

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
            <Camera className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Canlı Görüşme</h2>
            {continuousMode && (
              <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full animate-pulse">
                Canlı
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Camera View */}
        <div className="flex-1 relative overflow-hidden bg-black">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={startCamera}>
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
                  "w-full h-full object-cover",
                  !isActive && "opacity-0"
                )}
              />
              {!isActive && (
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
              
              {/* Overlay for capturing/analyzing states */}
              {(isCapturing || isAnalyzing) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                    <p>{isAnalyzing ? 'Analiz ediliyor...' : 'Yakalanıyor...'}</p>
                  </div>
                </div>
              )}

              {/* Analysis result with voice */}
              {currentAnalysis && !isAnalyzing && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 max-h-[40%] overflow-y-auto">
                  <div className="flex items-start gap-2">
                    {isPlaying || isVoiceLoading ? (
                      <Volume2 className="w-5 h-5 text-primary animate-pulse flex-shrink-0 mt-1" />
                    ) : null}
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
            {/* Switch Camera */}
            <Button 
              variant="outline" 
              size="icon"
              onClick={switchCamera}
              disabled={!isActive || isCapturing || isAnalyzing}
              className="h-12 w-12"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>

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
              disabled={!isActive || isCapturing || isAnalyzing}
              className="h-16 w-16 rounded-full"
            >
              {isCapturing || isAnalyzing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Camera className="w-6 h-6" />
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
                if (isPlaying) {
                  stopAudio();
                }
                setVoiceEnabled(!voiceEnabled);
              }}
              className={cn("h-12 w-12", !voiceEnabled && "opacity-50")}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
          </div>
          
          {/* Help text */}
          <p className="text-center text-xs text-muted-foreground mt-3">
            🎤 Sesli soru sorun • 📷 Tek kare • ▶️ Sürekli analiz
          </p>
        </div>
      </div>
    </div>
  );
};