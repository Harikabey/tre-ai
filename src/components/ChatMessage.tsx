import { useState, useMemo, useCallback } from 'react';
import { Message } from '@/types/chatbot';
import { Bot, User, Volume2, VolumeX, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/hooks/useVoice';
import { CitationPanel, Citation } from '@/components/CitationPanel';

interface ChatMessageProps {
  message: Message;
}

const WEB_SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`;

// Parse [SOURCES]...[/SOURCES] blocks from message content
const parseSources = (content: string): { cleanContent: string; sources: Citation[] } => {
  const sourceMatch = content.match(/\[SOURCES\]([\s\S]*?)\[\/SOURCES\]/);
  if (!sourceMatch) return { cleanContent: content, sources: [] };

  const cleanContent = content.replace(/\[SOURCES\][\s\S]*?\[\/SOURCES\]/g, '').trim();
  
  try {
    const parsed = JSON.parse(sourceMatch[1].trim());
    return { cleanContent, sources: parsed.sources || [] };
  } catch {
    return { cleanContent, sources: [] };
  }
};

// Search for sources using web-search edge function
const searchSources = async (query: string): Promise<Citation[]> => {
  try {
    const response = await fetch(WEB_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ query: query.slice(0, 200) }),
    });

    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.sources || []).map((s: any) => ({
      title: s.title || 'Kaynak',
      url: s.url || '#',
      snippet: s.snippet || '',
    }));
  } catch {
    return [];
  }
};

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const isBot = message.role === 'bot';
  const { playText, stopAudio, isPlaying, isLoading } = useVoice();
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = useState(false);

  // Extract file attachment if present
  const fileMatch = message.content.match(/\[Ek dosya: ([^\]]+)\]\(([^)]+)\)/);
  const fileName = fileMatch ? fileMatch[1] : null;
  const fileUrl = fileMatch ? fileMatch[2] : null;
  const isImage = fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  
  // Extract generated image (markdown format)
  const generatedImageMatch = message.content.match(/!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/);
  const generatedImageUrl = generatedImageMatch ? generatedImageMatch[2] : null;
  const generatedImageAlt = generatedImageMatch ? generatedImageMatch[1] : 'Generated image';
  
  // Parse sources from bot messages
  const { cleanContent: contentWithoutSources, sources } = useMemo(() => {
    if (isBot) return parseSources(message.content);
    return { cleanContent: message.content, sources: [] };
  }, [message.content, isBot]);

  // Clean content for display
  let displayContent = contentWithoutSources
    .replace(/\n\n\[Ek dosya: [^\]]+\]\([^)]+\)/, '')
    .replace(/\n\n--- Görsel Analizi ---[\s\S]*$/, '')
    .replace(/\n\n--- Dosya İçeriği ---[\s\S]*$/, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .trim();

  // Check if this is a factual/informational message (not a greeting or image)
  const isFactualMessage = isBot && displayContent.length > 60 && 
    !displayContent.includes('🎨 Görsel oluşturuluyor') &&
    !displayContent.startsWith('❌');

  const handleSearchSources = useCallback(async (query: string): Promise<Citation[]> => {
    return searchSources(query);
  }, []);

  const handlePlayAudio = async () => {
    if (isCurrentlyPlaying) {
      stopAudio();
      setIsCurrentlyPlaying(false);
    } else {
      setIsCurrentlyPlaying(true);
      const audioContent = displayContent
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/[#*_~`]/g, '')
        .trim();
      await playText(audioContent || message.content);
      setIsCurrentlyPlaying(false);
    }
  };

  return (
    <div
      className={cn(
        'flex gap-2 sm:gap-3 animate-fade-in',
        isBot ? 'justify-start' : 'justify-end'
      )}
    >
      {isBot && (
        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shadow-glow">
          <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          'max-w-[calc(100%-3rem)] sm:max-w-[80%] px-3 py-2 sm:px-4 sm:py-3 rounded-2xl overflow-hidden',
          isBot
            ? 'bg-card border border-border/50 rounded-tl-sm'
            : 'bg-primary/20 border border-primary/30 rounded-tr-sm'
        )}
      >
        {/* File attachment preview */}
        {fileUrl && (
          <div className="mb-2">
            {isImage ? (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <img 
                  src={fileUrl} 
                  alt={fileName || 'Attached image'} 
                  className="max-w-full max-h-40 sm:max-h-48 rounded-lg object-cover"
                />
              </a>
            ) : (
              <a 
                href={fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
              >
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-[200px]">{fileName}</span>
              </a>
            )}
          </div>
        )}

        {/* Generated image preview */}
        {generatedImageUrl && (
          <div className="mb-2">
            <img 
              src={generatedImageUrl} 
              alt={generatedImageAlt} 
              className="max-w-full max-h-48 sm:max-h-64 rounded-lg object-contain"
            />
          </div>
        )}

        {displayContent && (
          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
            {displayContent}
          </p>
        )}

        {/* Citation panel - shows for factual bot messages */}
        {isFactualMessage && (
          <CitationPanel 
            sources={sources} 
            messageContent={displayContent}
            onSearchSources={handleSearchSources}
          />
        )}
        
        <div className="flex items-center justify-between mt-1 gap-2">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          
          {/* Audio playback button for bot messages */}
          {isBot && displayContent && !displayContent.includes('🎨 Görsel oluşturuluyor') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 sm:h-6 sm:w-6"
              onClick={handlePlayAudio}
              disabled={isLoading && !isCurrentlyPlaying}
            >
              {isLoading && isCurrentlyPlaying ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : isCurrentlyPlaying && isPlaying ? (
                <VolumeX className="w-3 h-3 text-primary" />
              ) : (
                <Volume2 className="w-3 h-3 text-muted-foreground hover:text-primary" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {!isBot && (
        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
          <User className="w-3 h-3 sm:w-4 sm:h-4 text-accent" />
        </div>
      )}
    </div>
  );
};
