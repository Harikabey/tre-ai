// FILE: src/hooks/useAvatar.ts
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_BUCKET = 'avatars';

const MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type AvatarErrorCode = 'too-large' | 'unsupported-format';

export class AvatarError extends Error {
  constructor(public readonly code: AvatarErrorCode) {
    super(code === 'too-large'
      ? "Fotoğraf 2 MB'dan büyük olamaz."
      : 'Sadece JPG, PNG, WEBP, GIF yükleyebilirsin.');
    this.name = 'AvatarError';
  }
}

interface AvatarContextValue {
  avatarUrl: string | null;
  avatarInitials: string;
  loading: boolean;
  isUploading: boolean;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

const getInitials = (user: ReturnType<typeof useAuth>['user']): string => {
  if (!user) return 'U';
  const name = user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.user_metadata?.username
    || user.email?.split('@')[0]
    || 'U';
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr-TR') || 'U';
};

const signAvatar = async (path: string): Promise<string | null> => {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) { console.error('Profil fotoğrafı bağlantısı oluşturulamadı:', error); return null; }
  return data.signedUrl;
};

const getAvatarObjectPath = (avatarUrl: string | null, userId: string): string | null => {
  if (!avatarUrl) return null;
  if (!/^https?:/i.test(avatarUrl)) {
    const p = avatarUrl.split('?')[0];
    return p.startsWith(`${userId}.`) ? p : null;
  }

  try {
    const url = new URL(avatarUrl);
    const match = url.pathname.match(new RegExp(`/storage/v1/object/(?:public|sign)/${AVATAR_BUCKET}/`));
    if (!match || match.index === undefined) return null;
    const bucketMarker = match[0];
    const markerIndex = match.index;

    const path = decodeURIComponent(url.pathname.slice(markerIndex + bucketMarker.length));
    return path.startsWith(`${userId}.`) ? path : null;
  } catch {
    return null;
  }
};

const AvatarProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let active = true;

    if (authLoading) return () => { active = false; };
    if (!user) {
      setAvatarUrl(null);
      setLoading(false);
      return () => { active = false; };
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return () => { active = false; };
    }

    setAvatarUrl(null);
    setLoading(true);
    void supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Profil fotoğrafı alınamadı:', error);
          toast.error('Profil fotoğrafı alınamadı.');
        } else {
          const path = getAvatarObjectPath(data?.avatar_url ?? null, user.id);
          setAvatarPath(path);
          const signed = path ? await signAvatar(path) : null;
          if (!active) return;
          setAvatarUrl(signed);
        }
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Profil fotoğrafı alınamadı:', error);
        toast.error('Profil fotoğrafı alınamadı.');
        setLoading(false);
      });

    return () => { active = false; };
  }, [authLoading, user]);

  const uploadAvatar = useCallback(async (file: File) => {
    if (!user) throw new Error('Profil fotoğrafı yüklemek için giriş yapmalısın.');
    if (file.size > MAX_AVATAR_SIZE) throw new AvatarError('too-large');

    const suppliedMimeType = file.type.toLowerCase();
    const hasExtension = file.name.lastIndexOf('.') > 0;
    const fileExtension = hasExtension ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
    const extension = fileExtension || MIME_EXTENSIONS[suppliedMimeType] || '';
    const expectedMimeType = MIME_TYPES[extension];
    if (
      !expectedMimeType
      || (suppliedMimeType !== '' && suppliedMimeType !== expectedMimeType
        && !(extension === 'jpg' && suppliedMimeType === 'image/jpg'))
    ) {
      throw new AvatarError('unsupported-format');
    }

    if (!isSupabaseConfigured) {
      const error = new Error('Supabase bağlantısı kullanılamıyor.');
      toast.error('Fotoğraf yüklenirken hata oluştu.');
      throw error;
    }

    const objectPath = `${user.id}.${extension}`;
    const previousAvatarUrl = avatarUrl;
    setIsUploading(true);

    try {
      if (avatarPath && avatarPath !== objectPath) {
        await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
      }
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(objectPath, file, {
          cacheControl: '3600',
          contentType: expectedMimeType,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: `${objectPath}?v=${Date.now()}` }, { onConflict: 'id' });
      if (profileError) throw profileError;

      const signed = await signAvatar(objectPath);
      setAvatarPath(objectPath);
      setAvatarUrl(signed);
      toast.success('Profil fotoğrafı güncellendi.');
    } catch (error) {
      setAvatarUrl(previousAvatarUrl);
      console.error('Profil fotoğrafı yüklenemedi:', error);
      toast.error('Fotoğraf yüklenirken hata oluştu.');
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [avatarPath, avatarUrl, user]);

  const deleteAvatar = useCallback(async () => {
    if (!user) throw new Error('Profil fotoğrafını kaldırmak için giriş yapmalısın.');
    if (!isSupabaseConfigured) {
      const error = new Error('Supabase bağlantısı kullanılamıyor.');
      toast.error('Profil fotoğrafı kaldırılırken hata oluştu.');
      throw error;
    }

    const previousAvatarUrl = avatarPath;
    const objectPath = avatarPath;
    setIsUploading(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);
      if (profileError) throw profileError;

      if (objectPath) {
        const { error: storageError } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
        if (storageError) {
          const { error: restoreError } = await supabase
            .from('profiles')
            .update({ avatar_url: previousAvatarUrl })
            .eq('id', user.id);
          if (restoreError) console.error('Profil fotoğrafı geri yüklenemedi:', restoreError);
          throw storageError;
        }
      }

      setAvatarUrl(null);
      setAvatarPath(null);
      toast.success('Profil fotoğrafı kaldırıldı.');
    } catch (error) {
      console.error('Profil fotoğrafı kaldırılamadı:', error);
      toast.error('Profil fotoğrafı kaldırılırken hata oluştu.');
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [avatarPath, user]);

  const value = useMemo<AvatarContextValue>(() => ({
    avatarUrl,
    avatarInitials: getInitials(user),
    loading,
    isUploading,
    uploadAvatar,
    deleteAvatar,
  }), [avatarUrl, deleteAvatar, isUploading, loading, uploadAvatar, user]);

  return createElement(AvatarContext.Provider, { value }, children);
};

export const useAvatar = (): AvatarContextValue => {
  const context = useContext(AvatarContext);
  if (!context) throw new Error('useAvatar, AvatarProvider içinde kullanılmalıdır.');
  return context;
};

export { AvatarProvider };
