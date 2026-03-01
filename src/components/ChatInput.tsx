import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Plus, Zap, Brain, Image, FileText, X, Loader2, Mic, MicOff, Palette, Camera, Video, Film } from 'lucide-react';
import { ThinkingMode } from '@/hooks/useChatbot';
import { setVoiceMode } from '@/hooks/useChatbot';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { VoicePulseAnimation } from '@/components/VoicePulseAnimation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface ChatInputProps {
  onSend: (message: string, fileUrl?: string, generationType?: 'image' | 'gif') => void;
  disabled?: boolean;
  pendingQuestion?: string | null;
  thinkingMode: ThinkingMode;
  onThinkingModeChange: (mode: ThinkingMode) => void;
  onOpenCamera?: () => void;
  currentMood?: string;
}


export const ChatInput = ({ 
  onSend, 
  disabled, 
  pendingQuestion,
  thinkingMode,
  onThinkingModeChange,
  onOpenCamera,
  currentMood,
}: ChatInputProps) => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showVoiceAnimation, setShowVoiceAnimation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const haptic = useHapticFeedback();
  
  const { 
    isListening, 
    transcript, 
    isSupported: isSpeechSupported, 
    startListening, 
    stopListening,
    resetTranscript 
  } = useSpeechRecognition();

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) {
      toast.error('Dosya yüklemek için giriş yapın');
      return null;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        toast.error('Dosya yüklenemedi');
        return null;
      }

      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (signedError) {
        console.error('Signed URL error:', signedError);
        toast.error('Dosya URL oluşturulamadı');
        return null;
      }

      return signedUrlData.signedUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Dosya yüklenirken hata oluştu');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const readDocument = async (fileUrl: string, fileName: string, mimeType: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/read-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ fileUrl, fileName, mimeType }),
        }
      );

      if (!response.ok) {
        console.error('Document read error');
        return null;
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('Document read error:', error);
      return null;
    }
  };

  const analyzeImage = async (fileUrl: string, userPrompt?: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageUrl: fileUrl, prompt: userPrompt }),
        }
      );

      if (!response.ok) {
        console.error('Image analysis error');
        return null;
      }

      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error('Image analysis error:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || disabled || isUploading) return;

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    let fileUrl: string | undefined;
    let documentContent: string | null = null;
    let imageAnalysis: string | null = null;
    
    if (selectedFile) {
      const url = await uploadFile(selectedFile);
      if (url) {
        fileUrl = url;
        
        // Check if it's an image file
        const isImage = selectedFile.type.startsWith('image/') || 
          selectedFile.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
        
        // Check if it's a video file
        const isVideo = selectedFile.type.startsWith('video/') ||
          selectedFile.name.match(/\.(mp4|mov|avi|webm|mkv)$/i);
        
        if (isImage) {
          // Analyze image with optional user prompt
          const userPrompt = input.trim() || undefined;
          imageAnalysis = await analyzeImage(url, userPrompt);
        } else if (isVideo) {
          // Extract frame from video and analyze
          toast.info('Video karesi çıkarılıyor...');
          const frameDataUrl = await extractVideoFrame(selectedFile);
          if (frameDataUrl) {
            const userPrompt = input.trim() || 'Bu video karesini analiz et ve gördüklerini detaylı açıkla. Türkçe yanıt ver.';
            imageAnalysis = await analyzeImage(frameDataUrl, userPrompt);
          } else {
            toast.error('Video karesi çıkarılamadı');
          }
        } else {
          // Read document content if it's a readable file type
          const readableTypes = ['text/plain', 'application/json', 'text/csv', 'text/markdown'];
          const isReadable = readableTypes.some(type => selectedFile.type.includes(type)) ||
            selectedFile.name.match(/\.(txt|json|csv|md)$/i);
          
          if (isReadable || selectedFile.type.includes('application/pdf') || 
              selectedFile.name.match(/\.(doc|docx)$/i)) {
            documentContent = await readDocument(url, selectedFile.name, selectedFile.type);
          }
        }
      }
    }

    let messageContent = input.trim();
    
    if (fileUrl) {
      messageContent = `${messageContent}\n\n[Ek dosya: ${selectedFile?.name}](${fileUrl})`;
      
      // Add document content for AI context
      if (documentContent) {
        messageContent = `${messageContent}\n\n--- Dosya İçeriği ---\n${documentContent}`;
      }
      
      // Add image analysis for AI context
      if (imageAnalysis) {
        messageContent = `${messageContent}\n\n--- Görsel Analizi ---\n${imageAnalysis}`;
      }
    }

    if (messageContent) {
      onSend(messageContent, fileUrl);
      setInput('');
      setSelectedFile(null);
      resetTranscript();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageGeneration = () => {
    const prompt = input.trim();
    if (!prompt) {
      toast.info('Lütfen önce oluşturmak istediğiniz görseli tanımlayın, sonra "Görsel Oluştur" seçeneğine tıklayın');
      return;
    }
    if (isListening) stopListening();
    onSend(`🎨 Görsel oluştur: ${prompt}`, undefined, 'image');
    setInput('');
    resetTranscript();
  };

  const handleGifGeneration = () => {
    const prompt = input.trim();
    if (!prompt) {
      toast.info('Lütfen önce oluşturmak istediğiniz animasyonu tanımlayın, sonra "GIF Oluştur" seçeneğine tıklayın');
      return;
    }
    if (isListening) stopListening();
    onSend(`🎬 GIF oluştur: ${prompt}`, undefined, 'gif');
    setInput('');
    resetTranscript();
  };

  // Video generation is not currently supported by the AI gateway
  // const handleVideoGeneration = () => { ... };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (type: 'image' | 'document' | 'video') => {
    if (fileInputRef.current) {
      if (type === 'image') {
        fileInputRef.current.accept = 'image/*';
      } else if (type === 'video') {
        fileInputRef.current.accept = 'video/*';
      } else {
        fileInputRef.current.accept = '.pdf,.doc,.docx,.txt,.json,.csv,.md';
      }
      fileInputRef.current.click();
    }
  };

  const extractVideoFrame = async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadedmetadata = () => {
        // Seek to 1 second or middle of video
        video.currentTime = Math.min(1, video.duration / 2);
      };
      
      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };
      
      video.src = URL.createObjectURL(file);
      video.load();
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      setShowVoiceAnimation(false);
      setVoiceMode(false);
    } else {
      haptic.voiceActivate();
      startListening();
      setShowVoiceAnimation(true);
      setVoiceMode(true);
    }
  }, [isListening, startListening, stopListening, haptic]);

  // Long press handler for mic button
  const handleMicPointerDown = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      if (!isListening) {
        haptic.voiceActivate();
        startListening();
        setShowVoiceAnimation(true);
        setVoiceMode(true);
      }
    }, 1500);
  }, [isListening, startListening, haptic]);

  const handleMicPointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  return (
    <div className="p-3 sm:p-4 pb-safe border-t border-border/50 bg-card/50 backdrop-blur-sm safe-area-inset-bottom">
      {pendingQuestion && (
        <div className="mb-3 px-3 py-2 bg-accent/10 border border-accent/30 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-accent flex-wrap">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm">Öğretme modu: </span>
            <code className="px-1.5 py-0.5 bg-accent/20 rounded text-xs">
              /öğret [cevap]
            </code>
          </div>
          <p className="text-muted-foreground mt-1 text-xs line-clamp-2">
            "{pendingQuestion}" sorusunun cevabını öğretebilirsiniz
          </p>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="mb-3 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {selectedFile.type.startsWith('image/') ? (
              <Image className="w-4 h-4 text-primary flex-shrink-0" />
            ) : selectedFile.type.startsWith('video/') ? (
              <Video className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            )}
            <span className="text-muted-foreground truncate text-xs sm:text-sm">
              {selectedFile.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={removeFile}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Voice Recording Indicator */}
      {isListening && !showVoiceAnimation && (
        <div className="mb-3 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm flex items-center gap-2 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-destructive text-xs">Dinleniyor...</span>
        </div>
      )}
      
      <div className="flex gap-2 items-center">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Media Attachment Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-primary h-9 w-9 sm:h-10 sm:w-10"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => handleFileSelect('image')}>
              <Image className="w-4 h-4 mr-2" />
              Resim Ekle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('video')}>
              <Video className="w-4 h-4 mr-2" />
              Video Ekle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('document')}>
              <FileText className="w-4 h-4 mr-2" />
              Dosya Ekle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenCamera}>
              <Camera className="w-4 h-4 mr-2" />
              Canlı Görüntü
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImageGeneration}>
              <Palette className="w-4 h-4 mr-2" />
              Görsel Oluştur {!input.trim() && <span className="text-xs text-muted-foreground ml-1">(önce açıklama yazın)</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGifGeneration}>
              <Film className="w-4 h-4 mr-2" />
              GIF Oluştur {!input.trim() && <span className="text-xs text-muted-foreground ml-1">(önce açıklama yazın)</span>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Düşünme Modu</DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={() => onThinkingModeChange('fast')}
              className={thinkingMode === 'fast' ? 'bg-primary/10 text-primary' : ''}
            >
              <Zap className="w-4 h-4 mr-2" />
              <div className="flex flex-col">
                <span>Hızlı Yanıt</span>
                <span className="text-xs text-muted-foreground">Kısa ve hızlı cevaplar için</span>
              </div>
              {thinkingMode === 'fast' && <Sparkles className="w-3 h-3 ml-auto text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onThinkingModeChange('deep')}
              className={thinkingMode === 'deep' ? 'bg-primary/10 text-primary' : ''}
            >
              <Brain className="w-4 h-4 mr-2" />
              <div className="flex flex-col">
                <span>Derin Düşünce</span>
                <span className="text-xs text-muted-foreground">Kapsamlı ve detaylı analizler için</span>
              </div>
              {thinkingMode === 'deep' && <Sparkles className="w-3 h-3 ml-auto text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Voice Input Button */}
        {isSpeechSupported && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            onPointerDown={handleMicPointerDown}
            onPointerUp={handleMicPointerUp}
            onPointerLeave={handleMicPointerUp}
            className={`shrink-0 h-9 w-9 sm:h-10 sm:w-10 ${isListening ? 'text-destructive bg-destructive/10' : 'text-muted-foreground hover:text-primary'}`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </Button>
        )}

        {/* Message Input */}
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Konuşun..." : "Mesajınızı yazın..."}
            disabled={disabled}
            className="bg-input/50 border-border/50 focus-visible:ring-primary/30 text-sm sm:text-base h-9 sm:h-10"
          />
        </div>

        
        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={disabled || (!input.trim() && !selectedFile) || isUploading}
          variant="glow"
          size="icon"
          className="shrink-0 h-9 w-9 sm:h-10 sm:w-10"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Voice Pulse Animation Overlay */}
      <VoicePulseAnimation isActive={showVoiceAnimation} mood={currentMood} />
    </div>
  );
};
