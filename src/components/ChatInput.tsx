import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  pendingQuestion?: string | null;
}

export const ChatInput = ({ onSend, disabled, pendingQuestion }: ChatInputProps) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-border/50 bg-card/50 backdrop-blur-sm">
      {pendingQuestion && (
        <div className="mb-3 px-3 py-2 bg-accent/10 border border-accent/30 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="w-4 h-4" />
            <span>Öğretme modu: </span>
            <code className="px-1.5 py-0.5 bg-accent/20 rounded text-xs">
              /öğret [cevap]
            </code>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            "{pendingQuestion}" sorusunun cevabını öğretebilirsiniz
          </p>
        </div>
      )}
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesajınızı yazın..."
            disabled={disabled}
            className="pr-12 bg-input/50 border-border/50 focus-visible:ring-primary/30"
          />
        </div>
        
        <Button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          variant="glow"
          size="icon"
          className="shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
