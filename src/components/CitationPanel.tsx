import { useState, useCallback } from 'react';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

interface CitationPanelProps {
  sources: Citation[];
  messageContent?: string;
  onSearchSources?: (query: string) => Promise<Citation[]>;
}

export const CitationPanel = ({ sources: initialSources, messageContent, onSearchSources }: CitationPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sources, setSources] = useState<Citation[]>(initialSources);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(initialSources.length > 0);

  const handleSearchSources = useCallback(async () => {
    if (!onSearchSources || !messageContent || isSearching) return;
    
    setIsSearching(true);
    try {
      const results = await onSearchSources(messageContent);
      setSources(results);
      setHasSearched(true);
      setIsExpanded(true);
    } catch (error) {
      console.error('Source search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [onSearchSources, messageContent, isSearching]);

  // If no sources and hasn't searched yet, show search button
  if (!hasSearched && sources.length === 0) {
    return (
      <div className="mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSearchSources}
          disabled={isSearching}
          className="h-6 px-2 text-[10px] sm:text-xs text-muted-foreground hover:text-primary gap-1"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Kaynaklar aranıyor...
            </>
          ) : (
            <>
              <Search className="w-3 h-3" />
              Kaynakça Göster
            </>
          )}
        </Button>
      </div>
    );
  }

  if (sources.length === 0 && hasSearched) {
    return (
      <div className="mt-2">
        <span className="text-[10px] text-muted-foreground italic">Kaynak bulunamadı</span>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-6 px-2 text-[10px] sm:text-xs text-muted-foreground hover:text-primary gap-1"
      >
        <BookOpen className="w-3 h-3" />
        Kaynakça ({sources.length})
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 animate-fade-in">
          {sources.map((source, index) => (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors group"
            >
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 shrink-0">
                [{index + 1}]
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-foreground truncate">
                    {source.title}
                  </span>
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                {source.snippet && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                    {source.snippet}
                  </p>
                )}
                <span className="text-[9px] text-primary/60 truncate block">
                  {source.url}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
