import { useEffect, useRef, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LogEntry {
  readonly type: string;
  readonly args: string[];
}

function escapeScriptClosure(code: string): string {
  return code.replace(/<\/script>/gi, '<\\/script>');
}

function buildJsSrcDoc(code: string): string {
  const interceptor = `
(function() {
  function send(type, args) {
    try {
      parent.postMessage({ type: 'code-run-output', args: args.map(function(a) {
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
      }), type }, '*');
    } catch(e) {}
  }
  var orig = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  ['log','warn','error','info','debug'].forEach(function(m) {
    console[m] = function() {
      var a = Array.prototype.slice.call(arguments);
      orig[m].apply(console, a);
      send(m, a);
    };
  });
  window.addEventListener('error', function(e) {
    send('error', [e.message || String(e), e.filename || '', e.lineno || 0, e.colno || 0, e.error && e.error.stack ? String(e.error.stack) : '']);
  });
  window.addEventListener('unhandledrejection', function(e) {
    send('rejection', [String(e.reason)]);
  });
})();
`.trim();

  const wrapped = `<script>${interceptor}</script>\n<script>${escapeScriptClosure(code)}</script>`;

  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n${wrapped}\n</body>\n</html>`;
}

export const CodeRunner = ({ code, language, onClose }: { code: string; language: string; onClose: () => void }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'code-run-output') {
        setLogs(prev => [...prev, { type: e.data.type, args: e.data.args || [] }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    const srcDoc = language === 'javascript' || language === 'js'
      ? buildJsSrcDoc(code)
      : code;
    iframe.srcDoc = srcDoc;
  }, [code, language]);

  const handleClear = () => setLogs([]);

  return (
    <div className="mt-2 rounded-lg border border-border/50 bg-secondary/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 border-b border-border/40">
        <span className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Çalıştırma Sonucu
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]" onClick={handleClear} title="Temizle">
            <Trash2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]" onClick={onClose} title="Kapat">
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div className="relative">
        <iframe
          ref={iframeRef}
          className="w-full h-40 bg-white border-b border-border/30"
          sandbox="allow-scripts allow-modals"
          title="code-runner"
        />
      </div>
      {logs.length > 0 && (
        <div className="max-h-40 overflow-auto p-2 font-mono text-[11px] sm:text-xs bg-black/90 text-green-300">
          {logs.map((entry, i) => (
            <div key={i} className={cn(
              entry.type === 'error' || entry.type === 'rejection' ? 'text-red-400' : 'text-green-300'
            )}>
              <span className="text-muted-foreground">[{entry.type}]</span>{' '}
              {entry.args.join(' ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
