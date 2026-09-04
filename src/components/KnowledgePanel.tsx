import { KnowledgeItem } from '@/types/chatbot';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Trash2, MessageSquare, Zap, X } from 'lucide-react';

interface KnowledgePanelProps {
  knowledgeBase: KnowledgeItem[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onClose?: () => void;
}

export const KnowledgePanel = ({ knowledgeBase, onDelete, onClear, onClose }: KnowledgePanelProps) => {
  return (
    <div className="h-full flex flex-col bg-card/30 border-l border-border/50">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Bilgi Tabanı</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-primary/20 text-primary rounded-full">
              {knowledgeBase.length} kayıt
            </span>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 text-muted-foreground hover:text-foreground -mr-2"
                aria-label="Bilgi Tabanını kapat"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {knowledgeBase.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-secondary/50 border border-border/30 rounded-lg group hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-primary mb-1">
                    <MessageSquare className="w-3 h-3" />
                    <span className="font-medium">Soru</span>
                  </div>
                  <p className="text-sm text-foreground truncate">{item.question}</p>
                  
                  <div className="flex items-center gap-1.5 text-xs text-accent mt-2 mb-1">
                    <Zap className="w-3 h-3" />
                    <span className="font-medium">Cevap</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.answer}</p>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          
          {knowledgeBase.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Henüz bilgi yok</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {knowledgeBase.length > 0 && (
        <div className="p-4 border-t border-border/50">
          <Button
            variant="outline"
            onClick={onClear}
            className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Tümünü Temizle
          </Button>
        </div>
      )}
    </div>
  );
};
