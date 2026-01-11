import { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Plus, Zap, Brain, Image, FileText, X, Loader2, Mic, MicOff, Palette } from 'lucide-react';
import { ThinkingMode } from '@/hooks/useChatbot';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatInputProps {
  onSend: (message: string, fileUrl?: string, isImageGeneration?: boolean) => void;
  disabled?: boolean;
  pendingQuestion?: string | null;
  thinkingMode: ThinkingMode;
  onThinkingModeChange: (mode: ThinkingMode) => void;
}

export const ChatInput = ({ 
  onSend, 
  disabled, 
  pendingQuestion,
  thinkingMode,
  onThinkingModeChange,
}: ChatInputProps) => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

      const { data: publicUrl } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;
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
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
        
        if (isImage) {
          // Analyze image with optional user prompt
          const userPrompt = input.trim() || undefined;
          imageAnalysis = await analyzeImage(url, userPrompt);
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
    
    // Stop listening if active
    if (isListening) {
      stopListening();
    }
    
    onSend(`🎨 Görsel oluştur: ${prompt}`, undefined, true);
    setInput('');
    resetTranscript();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (type: 'image' | 'document') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.txt,.json,.csv,.md';
      fileInputRef.current.click();
    }
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

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

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
      {isListening && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm flex items-center gap-2 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-400 text-xs">Dinleniyor...</span>
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
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => handleFileSelect('image')}>
              <Image className="w-4 h-4 mr-2" />
              Resim Ekle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('document')}>
              <FileText className="w-4 h-4 mr-2" />
              Dosya Ekle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImageGeneration}>
              <Palette className="w-4 h-4 mr-2" />
              Görsel Oluştur {!input.trim() && <span className="text-xs text-muted-foreground ml-1">(önce açıklama yazın)</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Voice Input Button */}
        {isSpeechSupported && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            className={`shrink-0 h-9 w-9 sm:h-10 sm:w-10 ${isListening ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground hover:text-primary'}`}
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

        {/* Thinking Mode Toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-secondary/50 rounded-lg border border-border/50">
          <Button
            variant={thinkingMode === 'fast' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onThinkingModeChange('fast')}
            className={`h-7 w-7 sm:h-8 sm:w-8 ${thinkingMode === 'fast' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            title="Hızlı Yanıt"
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          <Button
            variant={thinkingMode === 'deep' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onThinkingModeChange('deep')}
            className={`h-7 w-7 sm:h-8 sm:w-8 ${thinkingMode === 'deep' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            title="Derin Düşünce"
          >
            <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
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
    </div>
  );
};
