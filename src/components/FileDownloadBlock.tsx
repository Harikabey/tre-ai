import { useCallback } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileBlock {
  fileName: string;
  content: string;
}

export const parseFileBlocks = (content: string): { cleanContent: string; files: FileBlock[] } => {
  const fileRegex = /\[FILE:([^\]]+)\]\n([\s\S]*?)\n\[\/FILE\]/g;
  const files: FileBlock[] = [];
  let match;

  while ((match = fileRegex.exec(content)) !== null) {
    files.push({
      fileName: match[1].trim(),
      content: match[2],
    });
  }

  const cleanContent = content.replace(/\[FILE:[^\]]+\]\n[\s\S]*?\n\[\/FILE\]/g, '').trim();
  return { cleanContent, files };
};

interface FileDownloadBlockProps {
  file: FileBlock;
}

export const FileDownloadBlock = ({ file }: FileDownloadBlockProps) => {
  const handleDownload = useCallback(() => {
    const blob = new Blob([file.content], { type: getMimeType(file.fileName) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [file]);

  const ext = file.fileName.split('.').pop()?.toLowerCase() || '';
  const sizeKB = Math.round(new Blob([file.content]).size / 1024 * 10) / 10;

  return (
    <div className="my-2 flex items-center gap-3 p-3 bg-secondary/50 border border-border/50 rounded-lg">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.fileName}</p>
        <p className="text-xs text-muted-foreground">{ext.toUpperCase()} • {sizeKB} KB</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0 gap-1.5"
        onClick={handleDownload}
      >
        <Download className="w-3.5 h-3.5" />
        İndir
      </Button>
    </div>
  );
};

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    svg: 'image/svg+xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    toml: 'application/toml',
    js: 'text/javascript',
    jsx: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    py: 'text/x-python',
    rb: 'text/x-ruby',
    go: 'text/x-go',
    rs: 'text/x-rust',
    java: 'text/x-java',
    kt: 'text/x-kotlin',
    swift: 'text/x-swift',
    c: 'text/x-c',
    cpp: 'text/x-c++',
    h: 'text/x-c',
    cs: 'text/x-csharp',
    php: 'text/x-php',
    sql: 'text/x-sql',
    sh: 'text/x-shellscript',
    bash: 'text/x-shellscript',
    lua: 'text/x-lua',
    r: 'text/x-r',
    dart: 'text/x-dart',
    log: 'text/plain',
    ini: 'text/plain',
    cfg: 'text/plain',
    conf: 'text/plain',
    env: 'text/plain',
  };
  return mimeMap[ext] || 'text/plain';
}
