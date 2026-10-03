// FILE: src/components/AvatarSettings.tsx
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AvatarError, useAvatar } from '@/hooks/useAvatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const AvatarSettings = () => {
  const { user } = useAuth();
  const { avatarUrl, avatarInitials, loading, isUploading, uploadAvatar, deleteAvatar } = useAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!user) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    try {
      await uploadAvatar(file);
    } catch (error) {
      setErrorMessage(error instanceof AvatarError
        ? error.message
        : 'Fotoğraf yüklenirken hata oluştu.');
    }
  };

  const handleDelete = async () => {
    setErrorMessage(null);
    try {
      await deleteAvatar();
    } catch {
      setErrorMessage('Profil fotoğrafı kaldırılırken hata oluştu.');
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Profil Fotoğrafı</CardTitle>
        <CardDescription>Kendine bir fotoğraf seç. Sohbette ve profilinde görünecek.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar className="h-24 w-24 shrink-0 border border-border">
          <AvatarImage src={avatarUrl ?? undefined} alt="Profil fotoğrafın" />
          <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">
            {avatarInitials}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-col items-start gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Profil fotoğrafı seç"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isUploading}
            >
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              Fotoğraf Yükle
            </Button>

            {avatarUrl && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={loading || isUploading}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Fotoğrafı Kaldır
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Profil fotoğrafını kaldır?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Profil fotoğrafını kaldırmak istediğine emin misin?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>İptal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleDelete()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Kaldır
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <p className="text-sm text-muted-foreground">JPG, PNG, WEBP veya GIF. En fazla 2 MB.</p>
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export { AvatarSettings };
