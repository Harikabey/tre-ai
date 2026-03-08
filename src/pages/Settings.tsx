import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Check, Bot, Sun, Moon, Monitor, Volume2, Globe, Search, ScreenShare, Mic, Mail, Shield, Loader2, CheckCircle2, Link2, Unlink, Type, Eye, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { personalities, Personality } from '@/types/personality';
import { voiceOptions, VoiceOption, VOICE_SETTINGS_KEY } from '@/types/voice';
import { languages, Language, LANGUAGE_KEY } from '@/types/language';
import { useTheme } from '@/hooks/useTheme';
import { useVoice } from '@/hooks/useVoice';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

const PERSONALITY_KEY = 'ai_chatbot_personality';
const SCREEN_SHARE_KEY = 'ai_chatbot_screen_share';
const TEXT_SCALE_KEY = 'ai_chatbot_text_scale';
const HIGH_CONTRAST_KEY = 'ai_chatbot_high_contrast';
const REDUCE_MOTION_KEY = 'ai_chatbot_reduce_motion';

const TEXT_SCALE_OPTIONS = [
  { value: 0.85, label: 'Küçük', description: 'Daha küçük yazı boyutu' },
  { value: 1, label: 'Normal', description: 'Varsayılan boyut' },
  { value: 1.15, label: 'Büyük', description: 'Daha büyük yazı boyutu' },
  { value: 1.3, label: 'Çok Büyük', description: 'En büyük yazı boyutu' },
];

type ThemeOption = {
  id: 'light' | 'dark' | 'system';
  name: string;
  description: string;
  icon: typeof Sun;
};

const themeOptions: ThemeOption[] = [
  {
    id: 'light',
    name: 'Açık Mod',
    description: 'Aydınlık tema',
    icon: Sun,
  },
  {
    id: 'dark',
    name: 'Koyu Mod',
    description: 'Karanlık tema',
    icon: Moon,
  },
  {
    id: 'system',
    name: 'Sistem',
    description: 'Cihaz ayarlarını takip et',
    icon: Monitor,
  },
];

const Settings = () => {
  const navigate = useNavigate();
  const [selectedPersonality, setSelectedPersonality] = useState<string>('friendly');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('tr');
  const [screenShareEnabled, setScreenShareEnabled] = useState<boolean>(() => {
    return localStorage.getItem(SCREEN_SHARE_KEY) === 'true';
  });
  const [languageSearch, setLanguageSearch] = useState('');
  const [textScale, setTextScale] = useState<number>(() => {
    const stored = localStorage.getItem(TEXT_SCALE_KEY);
    return stored ? parseFloat(stored) : 1;
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem(HIGH_CONTRAST_KEY) === 'true';
  });
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    return localStorage.getItem(REDUCE_MOTION_KEY) === 'true';
  });
  const { theme, setTheme } = useTheme();
  const { selectedVoiceId, updateVoice, playText, isLoading } = useVoice();
  const { user } = useAuth();
  const [emailConnected, setEmailConnected] = useState(false);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailConnecting, setEmailConnecting] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);

  const loadEmailStatus = useCallback(async () => {
    if (!user) { setEmailLoading(false); return; }
    const { data } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle();
    if (data) {
      const hasEmail = (data.scopes as string[] | null)?.includes('email');
      setEmailConnected(!!hasEmail);
      setConnectedEmail(data.provider_email);
      setConnectedAccountId(data.id);
    } else {
      setEmailConnected(false);
      setConnectedEmail(null);
      setConnectedAccountId(null);
    }
    setEmailLoading(false);
  }, [user]);

  useEffect(() => {
    loadEmailStatus();
  }, [loadEmailStatus]);

  useEffect(() => {
    const stored = localStorage.getItem(PERSONALITY_KEY);
    if (stored) setSelectedPersonality(stored);
    const storedLang = localStorage.getItem(LANGUAGE_KEY);
    if (storedLang) setSelectedLanguage(storedLang);
  }, []);

  const handleConnectEmail = async () => {
    if (!user) return;
    setEmailConnecting(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const isGoogleUser = currentUser?.app_metadata?.provider === 'google' ||
        currentUser?.identities?.some(i => i.provider === 'google');

      if (isGoogleUser) {
        const { error } = await supabase.from('connected_accounts').upsert({
          user_id: user.id,
          provider: 'google',
          provider_email: currentUser?.email || null,
          provider_display_name: currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || null,
          scopes: ['email', 'profile'],
          is_active: true,
        }, { onConflict: 'user_id,provider' });
        if (error) {
          toast.error('E-posta erişimi etkinleştirilemedi');
        } else {
          toast.success('E-posta erişimi etkinleştirildi!');
          loadEmailStatus();
        }
      } else {
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin + '/settings',
        });
        if (error) toast.error('Google ile bağlantı kurulamadı');
      }
    } catch {
      toast.error('Bağlantı hatası');
    } finally {
      setEmailConnecting(false);
    }
  };

  const handleDisconnectEmail = async () => {
    if (!connectedAccountId) return;
    const { error } = await supabase
      .from('connected_accounts')
      .delete()
      .eq('id', connectedAccountId);
    if (!error) {
      setEmailConnected(false);
      setConnectedEmail(null);
      setConnectedAccountId(null);
      toast.success('E-posta erişimi kaldırıldı');
    } else {
      toast.error('İşlem başarısız');
    }
  };

  const handleSelectPersonality = (id: string) => {
    setSelectedPersonality(id);
    localStorage.setItem(PERSONALITY_KEY, id);
  };

  const handleSelectLanguage = (code: string) => {
    setSelectedLanguage(code);
    localStorage.setItem(LANGUAGE_KEY, code);
  };

  const handleScreenShareToggle = (enabled: boolean) => {
    setScreenShareEnabled(enabled);
    localStorage.setItem(SCREEN_SHARE_KEY, String(enabled));
  };

  const handleTextScaleChange = (value: number) => {
    setTextScale(value);
    localStorage.setItem(TEXT_SCALE_KEY, String(value));
    document.documentElement.style.fontSize = `${value * 16}px`;
  };

  const handleHighContrastChange = (enabled: boolean) => {
    setHighContrast(enabled);
    localStorage.setItem(HIGH_CONTRAST_KEY, String(enabled));
    document.documentElement.classList.toggle('high-contrast', enabled);
  };

  const handleReduceMotionChange = (enabled: boolean) => {
    setReduceMotion(enabled);
    localStorage.setItem(REDUCE_MOTION_KEY, String(enabled));
    document.documentElement.classList.toggle('reduce-motion', enabled);
  };

  // Apply text scale and accessibility on mount
  useEffect(() => {
    document.documentElement.style.fontSize = `${textScale * 16}px`;
    if (highContrast) document.documentElement.classList.add('high-contrast');
    if (reduceMotion) document.documentElement.classList.add('reduce-motion');
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, []);

  const filteredLanguages = languages.filter(l =>
    l.name.toLowerCase().includes(languageSearch.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(languageSearch.toLowerCase()) ||
    l.code.toLowerCase().includes(languageSearch.toLowerCase())
  );

  const handleSelectVoice = (voiceId: string) => {
    updateVoice(voiceId);
  };

  const testVoice = (voice: VoiceOption) => {
    playText(`Merhaba, ben ${voice.name}. Size nasıl yardımcı olabilirim?`, voice.id);
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ayarlar</h1>
            <p className="text-muted-foreground text-sm">Uygulamayı özelleştirin</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Theme Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" />
                Tema
              </CardTitle>
              <CardDescription>
                Uygulama görünümünü seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <ThemeCard
                  key={option.id}
                  option={option}
                  isSelected={theme === option.id}
                  onSelect={() => setTheme(option.id)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Text Scale */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                Yazı Ölçeği
              </CardTitle>
              <CardDescription>
                Uygulama genelindeki yazı boyutunu ayarlayın
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {TEXT_SCALE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleTextScaleChange(option.value)}
                    className={`p-3 rounded-lg border text-center transition-all duration-200 ${
                      textScale === option.value
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border/50 bg-secondary/30 hover:border-primary/50'
                    }`}
                  >
                    <span
                      className="block font-medium text-foreground"
                      style={{ fontSize: `${option.value * 0.875}rem` }}
                    >
                      Aa
                    </span>
                    <span className="block text-[10px] text-muted-foreground mt-1">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Mevcut ölçek: {Math.round(textScale * 100)}%
              </p>
            </CardContent>
          </Card>

          {/* Screen Share Toggle */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScreenShare className="h-5 w-5 text-primary" />
                Ekran Paylaşma
              </CardTitle>
              <CardDescription>
                Ekranınızı AI ile paylaşarak analiz ettirin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm">Ekran Paylaşmayı Etkinleştir</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Sohbet menüsünde ekran paylaşma seçeneğini göster
                  </div>
                </div>
                <Switch
                  checked={screenShareEnabled}
                  onCheckedChange={handleScreenShareToggle}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Access Authorization */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                E-posta Erişimi
              </CardTitle>
              <CardDescription>
                TreFriend'in e-postalarınızı okumasına ve yönetmesine izin verin
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : emailConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">E-posta Erişimi Aktif</div>
                        {connectedEmail && (
                          <div className="text-xs text-muted-foreground mt-0.5">{connectedEmail}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                      onClick={handleDisconnectEmail}
                    >
                      <Unlink className="w-3.5 h-3.5 mr-1" />
                      Kaldır
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70 px-1">
                    <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>TreFriend e-postalarınızı okuyabilir, özetleyebilir ve taslak oluşturabilir. Erişimi istediğiniz zaman kaldırabilirsiniz.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-border/50 bg-secondary/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">Henüz bağlı değil</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Google hesabınızı bağlayarak AI'ın e-postalarınıza erişmesini sağlayın
                        </div>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleConnectEmail}
                      disabled={emailConnecting}
                    >
                      {emailConnecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4 mr-2" />
                      )}
                      Google Hesabını Bağla
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70 px-1">
                    <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>Hesap erişimi sadece sizin izninizle kullanılır. Verileriniz güvende tutulur.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voice Chat Section */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Sesli Sohbet
              </CardTitle>
              <CardDescription>
                Sesli komutlarla AI ile sohbet edin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => navigate('/voice-chat')}
                className="w-full p-4 rounded-lg border border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50 transition-all duration-200 text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground text-sm">Sesli Sohbeti Başlat</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Mikrofon ile konuşarak AI ile sesli sohbet edin
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                Ses Seçimi
              </CardTitle>
              <CardDescription>
                Bot cevaplarını sesli okutmak için bir ses seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {voiceOptions.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  isSelected={selectedVoiceId === voice.id}
                  onSelect={() => handleSelectVoice(voice.id)}
                  onTest={() => testVoice(voice)}
                  isLoading={isLoading}
                />
              ))}
            </CardContent>
          </Card>

          {/* Language Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Yanıt Dili
              </CardTitle>
              <CardDescription>
                Botun hangi dilde yanıt vereceğini seçin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Dil ara..."
                    value={languageSearch}
                    onChange={(e) => setLanguageSearch(e.target.value)}
                    className="pl-9 bg-input/50 border-border/50"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                {filteredLanguages.map((lang) => (
                  <LanguageCard
                    key={lang.code}
                    language={lang}
                    isSelected={selectedLanguage === lang.code}
                    onSelect={() => handleSelectLanguage(lang.code)}
                  />
                ))}
                {filteredLanguages.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-4">Sonuç bulunamadı</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Personality Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Bot Kişiliği
              </CardTitle>
              <CardDescription>
                Botun size nasıl yanıt vereceğini belirleyin
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {personalities.map((personality) => (
                <PersonalityCard
                  key={personality.id}
                  personality={personality}
                  isSelected={selectedPersonality === personality.id}
                  onSelect={() => handleSelectPersonality(personality.id)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface ThemeCardProps {
  option: ThemeOption;
  isSelected: boolean;
  onSelect: () => void;
}

const ThemeCard = ({ option, isSelected, onSelect }: ThemeCardProps) => {
  const Icon = option.icon;
  
  return (
    <button
      onClick={onSelect}
      className={`p-3 sm:p-4 rounded-lg border transition-all duration-200 text-center flex flex-col items-center gap-2 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="font-medium text-foreground text-xs sm:text-sm">{option.name}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{option.description}</div>
      {isSelected && (
        <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary flex items-center justify-center mt-1">
          <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};

interface VoiceCardProps {
  voice: VoiceOption;
  isSelected: boolean;
  onSelect: () => void;
  onTest: () => void;
  isLoading: boolean;
}

const VoiceCard = ({ voice, isSelected, onSelect, onTest, isLoading }: VoiceCardProps) => {
  return (
    <div
      className={`p-3 sm:p-4 rounded-lg border transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onSelect}
          className="flex-1 text-left flex items-center gap-3"
        >
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
            voice.gender === 'female' ? 'bg-pink-500/20 text-pink-500' : 'bg-blue-500/20 text-blue-500'
          }`}>
            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground text-sm">{voice.name}</div>
            <div className="text-xs text-muted-foreground truncate">{voice.description}</div>
          </div>
        </button>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onTest();
            }}
            disabled={isLoading}
            className="text-xs h-7 px-2"
          >
            Test
          </Button>
          {isSelected && (
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PersonalityCardProps {
  personality: Personality;
  isSelected: boolean;
  onSelect: () => void;
}

const PersonalityCard = ({ personality, isSelected, onSelect }: PersonalityCardProps) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 sm:p-4 rounded-lg border transition-all duration-200 text-left flex items-center gap-3 sm:gap-4 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <span className="text-2xl sm:text-3xl">{personality.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground text-sm sm:text-base">{personality.name}</div>
        <div className="text-xs sm:text-sm text-muted-foreground truncate">
          {personality.description}
        </div>
      </div>
      {isSelected && (
        <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};


interface LanguageCardProps {
  language: Language;
  isSelected: boolean;
  onSelect: () => void;
}

const LanguageCard = ({ language, isSelected, onSelect }: LanguageCardProps) => {
  return (
    <button
      onClick={onSelect}
      className={`p-2 sm:p-3 rounded-lg border transition-all duration-200 text-left flex items-center gap-2 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground text-xs sm:text-sm">{language.nativeName}</div>
        <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{language.name}</div>
      </div>
      {isSelected && (
        <div className="flex-shrink-0 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};

export default Settings;
