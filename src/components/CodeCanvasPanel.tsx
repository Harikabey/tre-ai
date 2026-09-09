import React, { useEffect, useRef, useState } from 'react';
import { X, Minimize2, Maximize2, Copy, Check, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeCanvasPanelProps {
  isOpen: boolean;
  code: string;
  fileName: string;
  onClose: () => void;
}

const CodeCanvasPanel: React.FC<CodeCanvasPanelProps> = ({ isOpen, code, fileName, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && iframeRef.current && code) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(code);
        doc.close();
      }
    }
  }, [isOpen, code]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCode = () => {
    if (iframeRef.current && code) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(code);
        doc.close();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-[480px] max-w-[90vw] bg-card/95 backdrop-blur-lg border-l border-border/50 shadow-2xl z-50 transition-all duration-300 flex flex-col',
        isMinimized ? 'h-[60px]' : 'h-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            🖥️ {fileName || 'Kod Önizleme'}
          </span>
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full flex-shrink-0">
            iframe
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRunCode}
            title="Çalıştır"
          >
            <Play className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopyCode}
            title="Kodu Kopyala"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Genişlet' : 'Küçült'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={onClose}
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Code preview (iframe) */}
      {!isMinimized && (
        <div className="flex-1 bg-black/90 p-1 min-h-0">
          <iframe
            ref={iframeRef}
            className="w-full h-full rounded border border-border/30 bg-white"
            sandbox="allow-scripts allow-modals allow-same-origin"
            title={`Preview: ${fileName}`}
          />
        </div>
      )}

      {/* Minimized state hint */}
      {isMinimized && (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-2">
          <span>📄 {fileName} — Tıkla genişlet</span>
        </div>
      )}
    </div>
  );
};

export default CodeCanvasPanel;
