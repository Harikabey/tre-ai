import { useState, KeyboardEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Plus, Zap, Brain, Image, FileText, X } from 'lucide-react';
import { ThinkingMode } from '@/hooks/useChatbot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatInputProps {
  onSend: (message: string) => void;
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
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
      setSelectedFile(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (type: 'image' | 'document') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.txt';
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

  return (
    <div className="p-4 pb-8 border-t border-border/50 bg-card/50 backdrop-blur-sm">
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

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="mb-3 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedFile.type.startsWith('image/') ? (
              <Image className="w-4 h-4 text-primary" />
            ) : (
              <FileText className="w-4 h-4 text-primary" />
            )}
            <span className="text-muted-foreground truncate max-w-[200px]">
              {selectedFile.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={removeFile}
          >
            <X className="w-3 h-3" />
          </Button>
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
              className="shrink-0 text-muted-foreground hover:text-primary"
            >
              <Plus className="w-5 h-5" />
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
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Message Input */}
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesajınızı yazın..."
            disabled={disabled}
            className="bg-input/50 border-border/50 focus-visible:ring-primary/30"
          />
        </div>

        {/* Thinking Mode Toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-secondary/50 rounded-lg border border-border/50">
          <Button
            variant={thinkingMode === 'fast' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onThinkingModeChange('fast')}
            className={`h-8 w-8 ${thinkingMode === 'fast' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            title="Hızlı Yanıt"
          >
            <Zap className="w-4 h-4" />
          </Button>
          <Button
            variant={thinkingMode === 'deep' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onThinkingModeChange('deep')}
            className={`h-8 w-8 ${thinkingMode === 'deep' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            title="Derin Düşünce"
          >
            <Brain className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Send Button */}
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
