import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { useVoice } from '@/hooks/useVoice';
import { Camera, X, RotateCcw, Loader2, AlertCircle, Volume2, VolumeX } from 'lucide-react';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentAnalysis, setCurrentAnalysis] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Start camera when opened
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      stopAudio();
    }
    
    return () => {
      stopCamera();
      stopAudio();
    };
  }, [isOpen, startCamera, stopCamera, stopAudio]);

  const handleCapture = async () => {
    const dataUrl = await captureFrame();
    if (!dataUrl) {
      toast.error('Görüntü yakalanamadı');
      return;
    }

    setIsAnalyzing(true);
    setCurrentAnalysis('');
    
    try {
      const prompt = userQuestion.trim() || 'Bu görüntüyü analiz et ve gördüklerini detaylı açıkla. Eğer yardım istenen bir durum varsa (örneğin bir nesne tanımlama, metin okuma, yön tarifi vb.) buna göre cevap ver. Türkçe yanıt ver.';
      
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
      toast.success('Görüntü analiz edildi');
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('Görüntü analizi başarısız');
    } finally {
      setIsAnalyzing(false);
    }
  };

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
            <h2 className="text-lg font-semibold">Canlı Görüntü</h2>
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

        {/* Question Input */}
        <div className="p-4 border-t border-border/50">
          <input
            type="text"
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            placeholder="Soru sorun (isteğe bağlı): Örn. 'Bu nedir?', 'Bunu nasıl kullanırım?'"
            className="w-full px-4 py-3 bg-input/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Controls */}
        <div className="p-4 pb-safe flex items-center justify-center gap-4 border-t border-border/50">
          <Button 
            variant="outline" 
            size="icon"
            onClick={switchCamera}
            disabled={!isActive || isCapturing || isAnalyzing}
            className="h-12 w-12"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          
          <Button
            variant="glow"
            size="lg"
            onClick={handleCapture}
            disabled={!isActive || isCapturing || isAnalyzing}
            className="h-16 w-16 rounded-full"
          >
            {isCapturing || isAnalyzing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Camera className="w-6 h-6" />
            )}
          </Button>

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

          <Button 
            variant="outline" 
            size="icon"
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="h-12 w-12"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
