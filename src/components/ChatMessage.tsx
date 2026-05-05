import { useState, useMemo, useCallback } from 'react';
import { Message } from '@/types/chatbot';
import { Bot, User, Volume2, VolumeX, Loader2, FileText, Copy, Check, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/hooks/useVoice';
import { CitationPanel, Citation } from '@/components/CitationPanel';
import { AnimatedFrames } from '@/components/AnimatedFrames';
import { CodeBlock } from '@/components/CodeBlock';
import { parseFileBlocks, FileDownloadBlock } from '@/components/FileDownloadBlock';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { getLanguageByCode } from '@/types/language';

interface ChatMessageProps {
  message: Message;
}

const WEB_SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`;

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
  const [copied, setCopied] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const fileMatch = message.content.match(/\[Ek dosya: ([^\]]+)\]\(([^)]+)\)/);
  const fileName = fileMatch ? fileMatch[1] : null;
  const fileUrl = fileMatch ? fileMatch[2] : null;
  const isImage = fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  
  const generatedImageMatch = message.content.match(/!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/);
  const generatedImageUrl = generatedImageMatch ? generatedImageMatch[2] : null;
  const generatedImageAlt = generatedImageMatch ? generatedImageMatch[1] : 'Generated image';

  const animatedFrames = useMemo(() => {
    const match = message.content.match(/\[ANIMATED_FRAMES\]([\s\S]*?)\[\/ANIMATED_FRAMES\]/);
    if (!match) return null;
    try {
      const frames = JSON.parse(match[1].trim());
      return Array.isArray(frames) && frames.length >= 2 ? frames : null;
    } catch { return null; }
  }, [message.content]);
  
  const { cleanContent: contentWithoutSources, sources } = useMemo(() => {
    if (isBot) return parseSources(message.content);
    return { cleanContent: message.content, sources: [] };
  }, [message.content, isBot]);

  // Parse file blocks for download
  const { cleanContent: contentWithoutFiles, files: downloadableFiles } = useMemo(() => {
    if (isBot) return parseFileBlocks(contentWithoutSources);
    return { cleanContent: contentWithoutSources, files: [] };
  }, [contentWithoutSources, isBot]);

  let displayContent = contentWithoutFiles
    .replace(/\n\n\[Ek dosya: [^\]]+\]\([^)]+\)/, '')
    .replace(/\n\n--- Görsel Analizi ---[\s\S]*$/, '')
    .replace(/\n\n--- Dosya İçeriği ---[\s\S]*$/, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[ANIMATED_FRAMES\][\s\S]*?\[\/ANIMATED_FRAMES\]/g, '')
    .trim();

  const isFactualMessage = isBot && displayContent.length > 60 && 
    !displayContent.includes('🎨 Görsel oluşturuluyor') &&
    !displayContent.startsWith('❌');

  const handleSearchSources = useCallback(async (query: string): Promise<Citation[]> => {
    return searchSources(query);
  }, []);

  const handleCopy = useCallback(() => {
    const plainText = displayContent
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/[#*_~`]/g, '')
      .trim();
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [displayContent]);

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

  const handleTranslate = useCallback(async () => {
    if (showTranslation && translatedContent) {
      setShowTranslation(false);
      return;
    }
    if (translatedContent) {
      setShowTranslation(true);
      return;
    }

    setIsTranslating(true);
    try {
      const userLang = localStorage.getItem('ai_chatbot_language') || 'tr';
      const langInfo = getLanguageByCode(userLang);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: displayContent,
            targetLanguage: langInfo.nativeName,
          }),
        }
      );

      if (!response.ok) throw new Error('Translation failed');
      const data = await response.json();
      setTranslatedContent(data.translatedText);
      setShowTranslation(true);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  }, [displayContent, translatedContent, showTranslation]);

  return (
    <div
      className={cn(
        'flex gap-2 sm:gap-3 animate-fade-in w-full min-w-0',
        isBot ? 'justify-start' : 'justify-end'
      )}
    >
      {isBot && (
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center mt-1">
          <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          'chat-bubble max-w-[calc(100%-3rem)] sm:max-w-[80%] min-w-0 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl overflow-hidden',
          isBot
            ? 'bg-card/80 border border-border/40 rounded-tl-md shadow-sm'
            : 'bg-primary/15 border border-primary/20 rounded-tr-md'
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

        {/* Animated frames (GIF) preview */}
        {animatedFrames && (
          <div className="mb-2">
            <AnimatedFrames frames={animatedFrames} delay={500} />
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

        {/* Downloadable file blocks */}
        {downloadableFiles.length > 0 && (
          <div className="mb-2">
            {downloadableFiles.map((file, index) => (
              <FileDownloadBlock key={index} file={file} />
            ))}
          </div>
        )}

        {displayContent && (
          isBot ? (
            <div className="text-xs sm:text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-a:text-primary prose-a:no-underline hover:prose-a:underline break-words overflow-hidden [word-break:break-word] [overflow-wrap:anywhere]">
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    const isInline = !className && !codeString.includes('\n');
                    
                    if (isInline) {
                      return <CodeBlock inline>{codeString}</CodeBlock>;
                    }
                    
                    return (
                      <CodeBlock language={match?.[1]}>
                        {codeString}
                      </CodeBlock>
                    );
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  }
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
              {displayContent}
            </p>
          )
        )}

        {/* Translation display */}
        {isBot && showTranslation && translatedContent && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <div className="text-[10px] text-muted-foreground/60 mb-1 flex items-center gap-1">
              <Languages className="w-3 h-3" />
              Çeviri
            </div>
            <div className="text-xs sm:text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 break-words [word-break:break-word] [overflow-wrap:anywhere]">
              <ReactMarkdown>{translatedContent}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Citation panel */}
        {isFactualMessage && (
          <CitationPanel 
            sources={sources} 
            messageContent={displayContent}
            onSearchSources={handleSearchSources}
          />
        )}
        
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground/70">
            {message.timestamp.toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          
          <div className="flex items-center gap-0.5">
            {/* Copy button for bot messages */}
            {isBot && displayContent && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 sm:h-6 sm:w-6"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-primary" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground/60 hover:text-foreground" />
                )}
              </Button>
            )}
            
            {/* Audio playback button */}
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
                  <Volume2 className="w-3 h-3 text-muted-foreground/60 hover:text-foreground" />
                )}
              </Button>
            )}

            {/* Translate button */}
            {isBot && displayContent && !displayContent.includes('🎨 Görsel oluşturuluyor') && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-5 w-5 sm:h-6 sm:w-6", showTranslation && "text-primary")}
                onClick={handleTranslate}
                disabled={isTranslating}
                title="Çevir"
              >
                {isTranslating ? (
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                ) : (
                  <Languages className={cn("w-3 h-3", showTranslation ? "text-primary" : "text-muted-foreground/60 hover:text-foreground")} />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {!isBot && (
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center mt-1">
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
        </div>
      )}
    </div>
  );
};
