import { useState, useRef, useCallback, TouchEvent } from 'react';
import { MessageSquare, Plus, Trash2, X, Check, Pencil, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  onRenameConversation?: (id: string, newTitle: string) => void;
  lockedIds?: string[];
}

const useSwipeToDelete = (onDelete: () => void, threshold = 80) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = startXRef.current - currentXRef.current;
    if (diff > 0) {
      setTranslateX(-Math.min(diff, 120));
    } else {
      setTranslateX(0);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const diff = startXRef.current - currentXRef.current;
    if (diff > threshold) {
      setTranslateX(-300);
      setTimeout(() => { onDelete(); setTranslateX(0); }, 200);
    } else {
      setTranslateX(0);
    }
  }, [threshold, onDelete]);

  return { translateX, isDragging, handleTouchStart, handleTouchMove, handleTouchEnd };
};

const ConversationItem = ({
  conv, isActive, onSelect, onDelete, onRename,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename?: (newTitle: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conv.title);
  const [showActions, setShowActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    translateX, isDragging,
    handleTouchStart: swipeTouchStart,
    handleTouchMove: swipeTouchMove,
    handleTouchEnd: swipeTouchEnd,
  } = useSwipeToDelete(onDelete, 80);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const startEditing = () => {
    setIsEditing(true);
    setEditTitle(conv.title);
    setShowActions(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editTitle.trim() && editTitle !== conv.title && onRename) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditTitle(conv.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit();
    else if (e.key === 'Escape') handleCancelEdit();
  };

  // Long press → show actions on mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    swipeTouchStart(e);
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      setShowActions(true);
    }, 500);
  }, [swipeTouchStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    swipeTouchMove(e);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, [swipeTouchMove]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!showActions) swipeTouchEnd();
  }, [swipeTouchEnd, showActions]);

  const showDeleteIndicator = translateX < -40;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete indicator background */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-destructive transition-opacity",
          showDeleteIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{ width: Math.abs(translateX) + 20 }}
      >
        <Trash2 className="h-5 w-5 text-destructive-foreground" />
      </div>

      {/* Swipeable content */}
      <div
        className={cn(
          "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all bg-card",
          isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent",
          isDragging && "transition-none"
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        } as React.CSSProperties}
        onClick={() => {
          if (showActions) { setShowActions(false); return; }
          if (!isEditing) onSelect();
        }}
      >
        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => handleSaveEdit()}
              onClick={(e) => e.stopPropagation()}
              className="h-7 text-sm px-2 py-0"
            />
          ) : (
            <>
              <div className="text-sm font-medium text-foreground truncate">{conv.title}</div>
              <div className="text-xs text-muted-foreground">{formatDate(conv.updated_at)}</div>
            </>
          )}
        </div>

        {/* Actions: hover on desktop, long-press on mobile */}
        <div className={cn(
          "flex items-center gap-1 transition-opacity",
          showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit}>
                <Check className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </>
          ) : (
            <>
              {onRename && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); startEditing(); }}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setShowActions(false); onDelete(); }}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const ConversationSidebar = ({
  conversations, currentConversationId, isOpen, onToggle,
  onSelectConversation, onNewConversation, onDeleteConversation, onRenameConversation,
}: ConversationSidebarProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const conversationToDelete = deleteId ? conversations.find(c => c.id === deleteId) : null;

  const confirmDelete = () => {
    if (deleteId) { onDeleteConversation(deleteId); setDeleteId(null); }
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />}

      <div className={cn(
        "transition-all duration-300 bg-card/95 backdrop-blur-sm border-r border-border/50 flex flex-col z-50",
        "fixed lg:relative inset-y-0 left-0",
        isOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full lg:translate-x-0"
      )}>
        {isOpen && (
          <>
            <div className="p-3 border-b border-border/50 flex items-center gap-2">
              <Button onClick={onNewConversation} className="flex-1 justify-start gap-2" variant="outline">
                <Plus className="h-4 w-4" /> Yeni Sohbet
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggle} className="lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">Henüz sohbet yok</div>
                ) : (
                  conversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={currentConversationId === conv.id}
                      onSelect={() => { onSelectConversation(conv.id); if (window.innerWidth < 1024) onToggle(); }}
                      onDelete={() => setDeleteId(conv.id)}
                      onRename={onRenameConversation ? (t) => onRenameConversation(conv.id, t) : undefined}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sohbeti sil?</AlertDialogTitle>
            <AlertDialogDescription>
              "{conversationToDelete?.title}" sohbetini silmek istediğinizden emin misiniz? Tüm mesajlar kalıcı olarak silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
