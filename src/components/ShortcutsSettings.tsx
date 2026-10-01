// FILE: src/components/ShortcutsSettings.tsx
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useUserShortcuts, type UserShortcut } from '@/hooks/useUserShortcuts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ShortcutFields {
  trigger: string;
  actionText: string;
}

export const ShortcutsSettings = () => {
  const { shortcuts, addShortcut, updateShortcut, deleteShortcut } = useUserShortcuts();
  const [newShortcut, setNewShortcut] = useState<ShortcutFields>({ trigger: '', actionText: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<ShortcutFields>({ trigger: '', actionText: '' });
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserShortcut | null>(null);

  const handleAdd = () => {
    const result = addShortcut(newShortcut.trigger, newShortcut.actionText);
    if (!result.success) {
      setError(result.error ?? 'Kısayol eklenemedi.');
      return;
    }
    setNewShortcut({ trigger: '', actionText: '' });
    setError('');
  };

  const beginEdit = (shortcut: UserShortcut) => {
    setEditingId(shortcut.id);
    setEditFields({ trigger: shortcut.trigger, actionText: shortcut.actionText });
    setError('');
  };

  const handleUpdate = (id: string) => {
    const result = updateShortcut(id, editFields.trigger, editFields.actionText);
    if (!result.success) {
      setError(result.error ?? 'Kısayol güncellenemedi.');
      return;
    }
    setEditingId(null);
    setError('');
  };

  const handleDelete = () => {
    if (deleteTarget) deleteShortcut(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Metin Kısayolları</CardTitle>
        <CardDescription>
          Kendi kısayollarınızı tanımlayın. Sohbette tetikleyiciyi yazıp boşluk/Enter'a bastığınızda otomatik genişletilir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-start">
          <Input
            value={newShortcut.trigger}
            onChange={event => setNewShortcut({ ...newShortcut, trigger: event.target.value })}
            placeholder="x veya /x"
            aria-label="Kısayol Kod"
            maxLength={21}
          />
          <Textarea
            value={newShortcut.actionText}
            onChange={event => setNewShortcut({ ...newShortcut, actionText: event.target.value })}
            placeholder="Aşağıdaki metni özetle:"
            aria-label="Genişletilecek Metin"
            maxLength={5000}
            rows={2}
            className="resize-y"
          />
          <Button type="button" onClick={handleAdd} className="sm:min-w-20">Ekle</Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {shortcuts.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Henüz kısayol tanımlamadınız.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {shortcuts.map(shortcut => (
              <div key={shortcut.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                {editingId === shortcut.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <Input
                        value={editFields.trigger}
                        onChange={event => setEditFields({ ...editFields, trigger: event.target.value })}
                        aria-label="Kısayol kodunu düzenle"
                        maxLength={21}
                      />
                      <Textarea
                        value={editFields.actionText}
                        onChange={event => setEditFields({ ...editFields, actionText: event.target.value })}
                        aria-label="Genişletilecek metni düzenle"
                        maxLength={5000}
                        rows={2}
                        className="resize-y"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => handleUpdate(shortcut.id)}>Kaydet</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setEditingId(null); setError(''); }}>İptal</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <code className="shrink-0 rounded bg-muted px-2 py-1 font-mono text-sm">{shortcut.trigger}</code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="min-w-0 cursor-default truncate text-sm text-muted-foreground">
                            {shortcut.actionText}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm whitespace-pre-wrap break-words">
                          {shortcut.actionText}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
                {editingId !== shortcut.id && (
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label="Düzenle" onClick={() => beginEdit(shortcut)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Sil" onClick={() => setDeleteTarget(shortcut)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kısayol silinsin mi?</AlertDialogTitle>
              <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Sil</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};