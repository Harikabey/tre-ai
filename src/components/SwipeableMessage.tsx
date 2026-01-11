import { ReactNode, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useSwipeToDelete } from '@/hooks/useSwipeToDelete';
import { cn } from '@/lib/utils';

interface SwipeableMessageProps {
  children: ReactNode;
  onDelete: () => void;
  messageId: string;
}

export const SwipeableMessage = ({ children, onDelete, messageId }: SwipeableMessageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    translateX,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSwipeToDelete({
    threshold: 80,
    onDelete,
  });

  const showDeleteIndicator = translateX < -30;
  const deleteOpacity = Math.min(Math.abs(translateX) / 80, 1);

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* Delete indicator background */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end pr-4",
          "bg-destructive/20 transition-opacity duration-200",
          showDeleteIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          width: Math.abs(translateX) + 20,
          opacity: deleteOpacity 
        }}
      >
        <div className="flex items-center gap-2 text-destructive">
          <Trash2 className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Sil</span>
        </div>
      </div>
      
      {/* Message content */}
      <div
        className={cn(
          "relative bg-background transition-transform",
          isDragging ? "" : "duration-200"
        )}
        style={{ 
          transform: `translateX(${translateX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};
