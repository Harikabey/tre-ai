import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Link2, Unlink, Shield, Mail, HardDrive, Calendar, 
  MessageSquare, Loader2, CheckCircle2, AlertCircle,
  Instagram, Twitter, Music, Github, Twitch, Linkedin
} from 'lucide-react';
import { toast } from 'sonner';

interface ConnectedAccount {
  id: string;
  provider: string;
  provider_email: string | null;
  provider_display_name: string | null;
  scopes: string[];
  is_active: boolean;
  connected_at: string;
}

const providerConfig: Record<string, {
  name: string;
  icon: typeof Mail;
  color: string;
  description: string;
  comingSoon?: boolean;
  availableScopes: { id: string; name: string; description: string; icon: typeof Mail }[];
}> = {
  google: {
    name: 'Google',
    icon: Mail,
    color: 'text-[hsl(var(--primary))]',
    description: 'Gmail, Drive, Calendar ve diğer Google servisleri',
    availableScopes: [
      { id: 'email', name: 'E-posta Okuma', description: 'Gmail gelen kutunuzu okuyabilir', icon: Mail },
      { id: 'drive', name: 'Dosya Erişimi', description: 'Google Drive dosyalarınıza erişebilir', icon: HardDrive },
      { id: 'calendar', name: 'Takvim', description: 'Takvim etkinliklerinizi görebilir', icon: Calendar },
    ],
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    description: 'Fotoğraflar, hikayeler ve mesajlar',
    comingSoon: true,
    availableScopes: [],
  },
  twitter: {
    name: 'X (Twitter)',
    icon: Twitter,
    color: 'text-foreground',
    description: 'Tweetler, mesajlar ve bildirimler',
    comingSoon: true,
    availableScopes: [],
  },
  spotify: {
    name: 'Spotify',
    icon: Music,
    color: 'text-green-500',
    description: 'Müzik, çalma listeleri ve dinleme geçmişi',
    comingSoon: true,
    availableScopes: [],
  },
  github: {
    name: 'GitHub',
    icon: Github,
    color: 'text-foreground',
    description: 'Repolar, issue\'lar ve pull request\'ler',
    comingSoon: true,
    availableScopes: [],
  },
  twitch: {
    name: 'Twitch',
    icon: Twitch,
    color: 'text-purple-500',
    description: 'Canlı yayınlar, sohbet ve abonelikler',
    comingSoon: true,
    availableScopes: [],
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-600',
    description: 'Profil, bağlantılar ve paylaşımlar',
    comingSoon: true,
    availableScopes: [],
  },
};

interface ConnectedAccountsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectedAccountsPanel = ({ isOpen, onClose }: ConnectedAccountsPanelProps) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .order('connected_at', { ascending: false });
    
    if (!error && data) {
      setAccounts(data as ConnectedAccount[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadAccounts();
    }
  }, [isOpen, user, loadAccounts]);

  const handleConnect = async (provider: string) => {
    if (provider === 'google') {
      setConnecting(provider);
      try {
        // Check if user is already signed in with Google
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const isGoogleUser = currentUser?.app_metadata?.provider === 'google' || 
          currentUser?.identities?.some(i => i.provider === 'google');

        if (isGoogleUser) {
          // User already signed in with Google, just register the connection
          const { error } = await supabase.from('connected_accounts').upsert({
            user_id: user!.id,
            provider: 'google',
            provider_email: currentUser?.email || null,
            provider_display_name: currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || null,
            scopes: ['email', 'profile'],
            is_active: true,
          }, { onConflict: 'user_id,provider' });

          if (error) {
            toast.error('Hesap bağlanamadı');
          } else {
            toast.success('Google hesabı bağlandı!');
            loadAccounts();
          }
        } else {
          // Need to sign in with Google first
          const { error } = await lovable.auth.signInWithOAuth("google", {
            redirect_uri: window.location.origin,
          });
          if (error) {
            toast.error('Google ile bağlantı kurulamadı');
          }
        }
      } catch (err) {
        toast.error('Bağlantı hatası oluştu');
      } finally {
        setConnecting(null);
      }
    }
  };

  const handleDisconnect = async (accountId: string, provider: string) => {
    const { error } = await supabase
      .from('connected_accounts')
      .delete()
      .eq('id', accountId);
    
    if (!error) {
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      toast.success(`${providerConfig[provider]?.name || provider} bağlantısı kaldırıldı`);
    } else {
      toast.error('Bağlantı kaldırılamadı');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-50 w-full max-w-lg max-h-[85vh] bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Bağlı Hesaplar</h2>
                <p className="text-xs text-muted-foreground">TreFriend'in erişebileceği hesaplarınız</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Provider cards */}
              {Object.entries(providerConfig).map(([providerId, config]) => {
                const connected = accounts.find(a => a.provider === providerId && a.is_active);
                const Icon = config.icon;

                return (
                  <div key={providerId} className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg bg-primary/10`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{config.name}</span>
                            {connected && (
                              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                <CheckCircle2 className="w-3 h-3" /> Bağlı
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                          {connected?.provider_email && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">{connected.provider_email}</p>
                          )}
                        </div>
                      </div>

                      {connected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                          onClick={() => handleDisconnect(connected.id, providerId)}
                        >
                          <Unlink className="w-3.5 h-3.5 mr-1" />
                          Kaldır
                        </Button>
                      ) : config.comingSoon ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          Yakında
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleConnect(providerId)}
                          disabled={connecting === providerId}
                        >
                          {connecting === providerId ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5 mr-1" />
                          )}
                          Bağla
                        </Button>
                      )}
                    </div>

                    {/* Scopes/permissions when connected */}
                    {connected && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> İzinler
                        </div>
                        <div className="grid gap-1.5">
                          {config.availableScopes.map(scope => {
                            const hasScope = connected.scopes?.includes(scope.id);
                            const ScopeIcon = scope.icon;
                            return (
                              <div key={scope.id} className="flex items-center gap-2 text-xs">
                                <ScopeIcon className={`w-3.5 h-3.5 ${hasScope ? 'text-primary' : 'text-muted-foreground/40'}`} />
                                <span className={hasScope ? 'text-foreground' : 'text-muted-foreground/50'}>
                                  {scope.name}
                                </span>
                                {hasScope ? (
                                  <CheckCircle2 className="w-3 h-3 text-primary ml-auto" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-muted-foreground/30 ml-auto" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Future providers placeholder */}
              <div className="rounded-xl border border-dashed border-border/40 p-4">
                <div className="text-center text-xs text-muted-foreground">
                  <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-40" />
                  <p>Instagram, Twitter ve diğer platformlar yakında eklenecek</p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>Hesap erişimleri sadece sizin izninizle kullanılır. İstediğiniz zaman bağlantıyı kaldırabilirsiniz.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
