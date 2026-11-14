import { useEffect } from 'react';
import { X } from 'lucide-react';

interface CodePreviewModalProps {
  code: string;
  fileName: string;
  language: string;
  onClose: () => void;
}

const escapeScriptClosure = (code: string) => code.replace(/<\/script/gi, '<\\/script');

const getPreviewDocument = (code: string, language: string) => {
  if (language === 'html') return code;
  if (language === 'css') {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${code}</style></head><body></body></html>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${escapeScriptClosure(code)}</script></body></html>`;
};

export const CodePreviewModal = ({ code, fileName, language, onClose }: CodePreviewModalProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${fileName} önizlemesi`}
    >
      <div className="flex h-[90vh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center border-b border-border px-4 py-3 pr-16">
          <span className="min-w-0 truncate font-mono text-sm text-foreground">{fileName}</span>
        </div>
        <iframe
          className="min-h-0 flex-1 bg-white"
          title={`${fileName} canlı önizleme`}
          sandbox="allow-scripts allow-modals"
          srcDoc={getPreviewDocument(code, language)}
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-4 z-[101] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Önizlemeyi kapat"
        title="Kapat"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};
