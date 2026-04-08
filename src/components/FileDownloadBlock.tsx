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
    // Text/Document
    txt: 'text/plain', md: 'text/markdown', rtf: 'text/rtf', log: 'text/plain',
    // Web
    html: 'text/html', htm: 'text/html', css: 'text/css', scss: 'text/x-scss', less: 'text/x-less',
    js: 'text/javascript', jsx: 'text/javascript', ts: 'text/typescript', tsx: 'text/typescript',
    vue: 'text/x-vue', svelte: 'text/x-svelte',
    // Data
    csv: 'text/csv', json: 'application/json', jsonl: 'application/x-jsonlines',
    xml: 'application/xml', yaml: 'text/yaml', yml: 'text/yaml', toml: 'application/toml',
    ini: 'text/plain', cfg: 'text/plain', env: 'text/plain', properties: 'text/plain',
    // Graphics
    svg: 'image/svg+xml', dot: 'text/vnd.graphviz', mermaid: 'text/plain',
    // Programming
    py: 'text/x-python', java: 'text/x-java', c: 'text/x-c', cpp: 'text/x-c++',
    h: 'text/x-c', hpp: 'text/x-c++', cs: 'text/x-csharp', go: 'text/x-go',
    rs: 'text/x-rust', rb: 'text/x-ruby', php: 'text/x-php', swift: 'text/x-swift',
    kt: 'text/x-kotlin', scala: 'text/x-scala', r: 'text/x-r', m: 'text/x-objectivec',
    lua: 'text/x-lua', dart: 'text/x-dart', pl: 'text/x-perl', ex: 'text/x-elixir',
    exs: 'text/x-elixir', hs: 'text/x-haskell', clj: 'text/x-clojure',
    groovy: 'text/x-groovy', v: 'text/x-v', zig: 'text/x-zig',
    // Shell/Script
    sh: 'text/x-shellscript', bash: 'text/x-shellscript', zsh: 'text/x-shellscript',
    fish: 'text/x-shellscript', ps1: 'text/x-powershell', bat: 'text/x-bat', cmd: 'text/x-bat',
    // Database
    sql: 'text/x-sql', prisma: 'text/plain', graphql: 'text/plain', gql: 'text/plain',
    // Config
    dockerfile: 'text/x-dockerfile', dockerignore: 'text/plain', gitignore: 'text/plain',
    editorconfig: 'text/plain', eslintrc: 'application/json', prettierrc: 'application/json',
    nginx: 'text/plain', htaccess: 'text/plain', conf: 'text/plain',
    // Other
    tex: 'text/x-latex', bib: 'text/x-bibtex', makefile: 'text/x-makefile',
    cmake: 'text/x-cmake', proto: 'text/x-protobuf', tf: 'text/plain', tfvars: 'text/plain',
    gradle: 'text/x-gradle', pom: 'application/xml',
  };
  return mimeMap[ext] || 'text/plain';
}
