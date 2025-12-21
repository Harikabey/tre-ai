import { MessageSquare, Plus, Trash2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  personality: string;
  created_at: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export const ConversationSidebar = ({
  conversations,
  currentConversationId,
  isOpen,
  onToggle,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ConversationSidebarProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  return (
    <div
      className={cn(
        "transition-all duration-300 bg-card/50 backdrop-blur-sm border-r border-border/50 flex flex-col",
        isOpen ? "w-64" : "w-0"
      )}
    >
      {isOpen && (
        <>
          <div className="p-3 border-b border-border/50">
            <Button
              onClick={onNewConversation}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Yeni Sohbet
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Henüz sohbet yok
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all",
                      currentConversationId === conv.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-secondary/50 border border-transparent"
                    )}
                    onClick={() => onSelectConversation(conv.id)}
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {conv.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(conv.updated_at)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};
