import { useState } from 'react';
import { Image, RefreshCw, Download, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: Date;
}

interface ImageHistoryPanelProps {
  images: GeneratedImage[];
  onRegenerate: (prompt: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageHistoryPanel = ({
  images,
  onRegenerate,
  onDelete,
  onClear,
  isOpen,
  onClose,
}: ImageHistoryPanelProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleDownload = async (url: string, prompt: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={onClose} />
      
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-border/50 z-50 flex flex-col animate-in slide-in-from-right">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Görsel Geçmişi</h2>
            <span className="text-xs text-muted-foreground">({images.length})</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {images.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Henüz görsel üretilmedi</p>
              </div>
            ) : (
              images.map((image) => (
                <div
                  key={image.id}
                  className="group relative rounded-lg border border-border/50 overflow-hidden bg-secondary/30"
                >
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full aspect-square object-cover"
                  />
                  
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onRegenerate(image.prompt)}
                        title="Yeniden oluştur"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(image.url, image.prompt)}
                        title="İndir"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setDeleteId(image.id)}
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Prompt text */}
                  <div className="p-2 bg-card/80 backdrop-blur-sm">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {image.prompt}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {image.timestamp.toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {images.length > 0 && (
          <div className="p-3 border-t border-border/50">
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Tümünü Temizle
            </Button>
          </div>
        )}
      </div>

      {/* Delete single image confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Görseli sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu görseli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  onDelete(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tüm görselleri sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Tüm görsel geçmişini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onClear();
                setShowClearConfirm(false);
              }}
            >
              Tümünü Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
