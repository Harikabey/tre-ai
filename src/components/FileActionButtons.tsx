// FILE: src/components/FileActionButtons.tsx
import { useEffect, useState } from 'react';
import { Check, Copy, Download, Eye, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FileActionButtonsProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  onPreview?: () => void;
  fileContent?: string;
  className?: string;
}

const PLAYABLE_FILE_TYPES = new Set([
  'mp3', 'mp4', 'wav', 'ogg', 'gif', 'png', 'jpg', 'jpeg', 'webp', 'pdf', 'svg',
]);
const IMAGE_FILE_TYPES = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'svg']);
const AUDIO_FILE_TYPES = new Set(['mp3', 'wav', 'ogg']);
const CODE_FILE_TYPES = new Set(['py', 'js', 'ts', 'jsx', 'tsx']);
const RUNNABLE_FILE_TYPES = new Set(['html', 'htm', 'js', 'css']);

export const FileActionButtons = ({
  fileUrl,
  fileName,
  fileType,
  onPreview,
  fileContent,
  className,
}: FileActionButtonsProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const normalizedType = fileType.trim().toLowerCase().replace(/^\./, '').split('/').pop() || '';
  const safeFileName = fileName.trim() || 'dosya';
  const canPreview = PLAYABLE_FILE_TYPES.has(normalizedType);
  const canCopy = CODE_FILE_TYPES.has(normalizedType);

  useEffect(() => {
    if (fileUrl.startsWith('blob:')) {
      window.addEventListener('pagehide', () => URL.revokeObjectURL(fileUrl), { once: true });
    }
  }, [fileUrl]);

  if (!fileUrl.trim()) return null;

  const handlePreview = () => {
    if (onPreview) {
      onPreview();
      return;
    }

    if (normalizedType === 'pdf') {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setPreviewOpen(true);
  };

  const handleCopy = async () => {
    try {
      const content = fileContent ?? await (await fetch(fileUrl)).text();
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Dosya panoya kopyalanamadı:', error);
    }
  };

  const handleDownload = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (fileUrl.startsWith('blob:') || fileUrl.startsWith('data:')) return;

    try {
      const url = new URL(fileUrl, window.location.href);
      if (url.origin === window.location.origin) return;

      event.preventDefault();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Dosya indirilemedi: ${response.status}`);

      const blobUrl = URL.createObjectURL(await response.blob());
      window.addEventListener('pagehide', () => URL.revokeObjectURL(blobUrl), { once: true });
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = safeFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error('Dosya indirilemedi:', error);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div className={`flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 ${className || ''}`}>
        <Button asChild variant="outline" size="sm">
          <a href={fileUrl} download={safeFileName} onClick={(event) => { void handleDownload(event); }}>
            <Download aria-hidden="true" />
            İndir
          </a>
        </Button>
        {canPreview && (
          <Button variant="outline" size="sm" onClick={handlePreview}>
            {normalizedType === 'pdf' || IMAGE_FILE_TYPES.has(normalizedType)
              ? <Eye aria-hidden="true" />
              : <Play aria-hidden="true" />}
            {normalizedType === 'pdf' || IMAGE_FILE_TYPES.has(normalizedType) ? 'Görüntüle' : 'Oynat'}
          </Button>
        )}
        {canCopy && (
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </Button>
        )}
        {onPreview && RUNNABLE_FILE_TYPES.has(normalizedType) && !canPreview && (
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Play aria-hidden="true" />
            Çalıştır
          </Button>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="break-all">{safeFileName}</DialogTitle>
          </DialogHeader>
          {IMAGE_FILE_TYPES.has(normalizedType) && (
            <img src={fileUrl} alt={safeFileName} className="mx-auto max-h-[75vh] max-w-full object-contain" />
          )}
          {AUDIO_FILE_TYPES.has(normalizedType) && (
            <audio controls autoPlay src={fileUrl} className="w-full" />
          )}
          {normalizedType === 'mp4' && (
            <video controls autoPlay src={fileUrl} className="max-h-[75vh] max-w-full" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};