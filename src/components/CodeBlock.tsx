import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: string;
  language?: string;
  inline?: boolean;
}

export const CodeBlock = ({ children, language, inline }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded text-xs sm:text-sm bg-primary/10 text-primary font-mono break-all">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-border/50 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 border-b border-border/40">
        <span className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-xs transition-all duration-200",
            copied 
              ? "text-primary bg-primary/10" 
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              <span>Kopyalandı</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Kopyala</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="p-3 overflow-x-auto bg-secondary/40 text-xs sm:text-sm max-w-full">
        <code className="font-mono text-foreground/90 whitespace-pre break-words">
          {children}
        </code>
      </pre>
    </div>
  );
};
