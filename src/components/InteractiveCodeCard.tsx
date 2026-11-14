import { useState } from 'react';
import { Braces, Code2, Download, FileCode2, FileText, Play } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CodePreviewModal } from '@/components/CodePreviewModal';

interface InteractiveCodeCardProps {
  code: string;
  language: string;
}

const languageDetails: Record<string, { fileName: string; label: string; icon: typeof Code2 }> = {
  html: { fileName: 'index.html', label: 'HTML', icon: FileCode2 },
  css: { fileName: 'styles.css', label: 'CSS', icon: Code2 },
  javascript: { fileName: 'script.js', label: 'JavaScript', icon: Braces },
  js: { fileName: 'script.js', label: 'JavaScript', icon: Braces },
  python: { fileName: 'script.py', label: 'Python', icon: Code2 },
  py: { fileName: 'script.py', label: 'Python', icon: Code2 },
  typescript: { fileName: 'script.ts', label: 'TypeScript', icon: Braces },
  ts: { fileName: 'script.ts', label: 'TypeScript', icon: Braces },
  jsx: { fileName: 'App.jsx', label: 'JSX', icon: Braces },
  tsx: { fileName: 'App.tsx', label: 'TSX', icon: Braces },
};

const keywords = /\b(?:const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|async|await|try|catch|throw|def|print|in|is|not|and|or|True|False|None|self|public|private|interface|type|extends|implements|void|null|undefined)\b/;
const tokenPattern = /(<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;

const renderHighlightedCode = (code: string, language: string) => {
  const tokens = code.split(tokenPattern);
  return tokens.map((token, index) => {
    if (!token) return null;

    let className = '';
    if (token.startsWith('<!--') || token.startsWith('/*') || token.startsWith('//') ||
      (language === 'python' || language === 'py') && token.startsWith('#')) {
      className = 'text-muted-foreground italic';
    } else if (token.startsWith('<') && token.endsWith('>')) {
      className = 'text-sky-500';
    } else if (/^(["'`])/.test(token)) {
      className = 'text-emerald-500';
    } else if (/^\d/.test(token)) {
      className = 'text-amber-500';
    } else if (keywords.test(token)) {
      className = 'text-violet-500';
    }

    return className
      ? <span key={index} className={className}>{token}</span>
      : <span key={index}>{token}</span>;
  });
};

export const InteractiveCodeCard = ({ code, language }: InteractiveCodeCardProps) => {
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const normalizedLanguage = language.toLowerCase();
  const details = languageDetails[normalizedLanguage];
  const Icon = details.icon;

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = details.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleRun = () => {
    if (normalizedLanguage === 'python' || normalizedLanguage === 'py') {
      toast({
        title: 'Python tarayıcıda çalıştırılamıyor',
        description: 'Bu kodu çalıştırmak için lütfen dosyayı indirin.',
      });
      return;
    }
    if (normalizedLanguage === 'html' || normalizedLanguage === 'css' ||
      normalizedLanguage === 'js' || normalizedLanguage === 'javascript') {
      setIsPreviewOpen(true);
      return;
    }
    toast({
      title: 'Önizleme desteklenmiyor',
      description: 'TypeScript ve JSX kodlarını çalıştırmadan önce derlemeniz gerekir.',
    });
  };

  return (
    <>
      <section className="my-3 w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <header className="flex min-w-0 items-center gap-2 border-b border-border/50 bg-secondary/50 px-3 py-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
            {details.fileName}
          </span>
          <span className="shrink-0 rounded bg-background/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {details.label}
          </span>
        </header>

        {isCodeVisible && (
          <pre className="m-0 max-h-60 min-w-0 overflow-y-auto overflow-x-auto bg-secondary/20 p-3 text-xs leading-relaxed">
            <code className="whitespace-pre font-mono">{renderHighlightedCode(code, normalizedLanguage)}</code>
          </pre>
        )}

        <footer className="flex flex-wrap items-center gap-2 p-2">
          <button
            type="button"
            onClick={handleRun}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Çalıştır
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            İndir
          </button>
          <button
            type="button"
            onClick={() => setIsCodeVisible((visible) => !visible)}
            aria-expanded={isCodeVisible}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {isCodeVisible ? 'İçeriği Gizle' : 'İçeriği Göster'}
          </button>
        </footer>
      </section>

      {isPreviewOpen && (
        <CodePreviewModal
          code={code}
          fileName={details.fileName}
          language={normalizedLanguage === 'javascript' ? 'js' : normalizedLanguage}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </>
  );
};
