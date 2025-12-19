import { Message } from '@/types/chatbot';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const isBot = message.role === 'bot';

  return (
    <div
      className={cn(
        'flex gap-3 animate-fade-in',
        isBot ? 'justify-start' : 'justify-end'
      )}
    >
      {isBot && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shadow-glow">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          'max-w-[80%] px-4 py-3 rounded-2xl',
          isBot
            ? 'bg-card border border-border/50 rounded-tl-sm'
            : 'bg-primary/20 border border-primary/30 rounded-tr-sm'
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        <span className="text-[10px] text-muted-foreground mt-1 block">
          {message.timestamp.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
      
      {!isBot && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
          <User className="w-4 h-4 text-accent" />
        </div>
      )}
    </div>
  );
};
