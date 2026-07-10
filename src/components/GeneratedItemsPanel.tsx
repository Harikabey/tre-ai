import { useMemo, useState } from 'react';
import {
  X, Trash2, Download, Pencil, Search, FolderOpen,
  Image as ImageIcon, Film, Music, FileText, FileCode, FileArchive, Package, Presentation, FileSpreadsheet, File as FileIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { GeneratedItem, GeneratedItemKind } from '@/hooks/useGeneratedItems';

interface Props {
  items: GeneratedItem[];
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onClear: () => void;
}

const KIND_LABELS: Record<GeneratedItemKind, string> = {
  image: 'Görsel', gif: 'GIF', video: 'Video', audio: 'Ses',
  code: 'Kod', document: 'Belge', apk: 'APK', iso: 'ISO',
  pptx: 'Sunum', pdf: 'PDF', word: 'Word', excel: 'Excel', other: 'Diğer',
};

const kindIcon = (kind: GeneratedItemKind) => {
  const cls = 'w-5 h-5 text-primary';
  switch (kind) {
    case 'image': return <ImageIcon className={cls} />;
    case 'gif': return <ImageIcon className={cls} />;
    case 'video': return <Film className={cls} />;
    case 'audio': return <Music className={cls} />;
    case 'code': return <FileCode className={cls} />;
    case 'apk': return <Package className={cls} />;
    case 'iso': return <FileArchive className={cls} />;
    case 'pptx': return <Presentation className={cls} />;
    case 'pdf': return <FileText className={cls} />;
    case 'word': return <FileText className={cls} />;
    case 'excel': return <FileSpreadsheet className={cls} />;
    default: return <FileIcon className={cls} />;
  }
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const FILTERS: { value: 'all' | GeneratedItemKind; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'image', label: 'Görseller' },
  { value: 'gif', label: 'GIF' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Ses' },
  { value: 'code', label: 'Kod' },
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'pptx', label: 'Sunum' },
  { value: 'apk', label: 'APK' },
  { value: 'iso', label: 'ISO' },
];

export const GeneratedItemsPanel = ({ items, isOpen, onClose, onDelete, onRename, onClear }: Props) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | GeneratedItemKind>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);
  const [renameTarget, setRenameTarget] = useState<GeneratedItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => filter === 'all' || i.kind === filter)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.prompt || '').toLowerCase().includes(q));
  }, [items, filter, query]);

  const handleDownload = (item: GeneratedItem) => {
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openPreview = (item: GeneratedItem) => {
    if (item.kind === 'image' || item.kind === 'gif') {
      const url = URL.createObjectURL(item.blob);
      setPreviewUrl(url);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 max-w-full bg-card border-l border-border/50 z-50 flex flex-col animate-in slide-in-from-right safe-area-inset-top">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
            <h2 className="font-semibold truncate">Üretilen Dosyalar</h2>
            <span className="text-xs text-muted-foreground">({items.length})</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 border-b border-border/50 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ara..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-thin [&>*]:flex-shrink-0">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{items.length === 0 ? 'Henüz dosya üretilmedi' : 'Sonuç bulunamadı'}</p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center cursor-pointer"
                    onClick={() => openPreview(item)}
                  >
                    {kindIcon(item.kind)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {KIND_LABELS[item.kind]} • {formatSize(item.size)} • {new Date(item.createdAt).toLocaleString('tr-TR')}
                    </p>
                    {item.prompt && (
                      <p className="text-[10px] text-muted-foreground/70 truncate italic">{item.prompt}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Yeniden adlandır"
                      onClick={() => { setRenameTarget(item); setRenameValue(item.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="İndir"
                      onClick={() => handleDownload(item)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                      title="Sil"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {items.length > 0 && (
          <div className="p-3 border-t border-border/50">
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setShowClear(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Tümünü Temizle
            </Button>
          </div>
        )}
      </div>

      {/* Image preview */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => { if (!o && previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Önizleme</DialogTitle></DialogHeader>
          {previewUrl && <img src={previewUrl} alt="preview" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dosyayı yeniden adlandır</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>İptal</Button>
            <Button
              onClick={() => {
                if (renameTarget && renameValue.trim()) {
                  onRename(renameTarget.id, renameValue.trim());
                }
                setRenameTarget(null);
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dosyayı sil?</AlertDialogTitle>
            <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all */}
      <AlertDialog open={showClear} onOpenChange={setShowClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tüm dosyaları sil?</AlertDialogTitle>
            <AlertDialogDescription>Tüm üretilmiş dosyalar silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onClear(); setShowClear(false); }}
            >
              Tümünü Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
