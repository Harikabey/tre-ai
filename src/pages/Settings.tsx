import { useState, useEffect, useCallback, useReducer } from 'react';
import { ArrowLeft, Check, Bot, Sun, Moon, Monitor, Volume2, Globe, Search, ScreenShare, Mic, Mail, Shield, Loader2, CheckCircle2, Link2, Unlink, Type, Eye, Zap, Trash2, Palette, MessageSquare, Image as ImageIcon, RotateCcw, Brain, Bell, Send, Download, Smartphone, Sparkles } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useUICustomization, ACCENT_HSL, ACCENT_LABELS, FONT_LABELS, BUBBLE_LABELS, WALLPAPER_LABELS, type AccentColor, type FontFamily, type BubbleStyle, type Wallpaper } from '@/hooks/useUICustomization';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { personalities, Personality } from '@/types/personality';
import { voiceOptions, VoiceOption } from '@/types/voice';
import { languages, Language } from '@/types/language';
import { useVoice } from '@/hooks/useVoice';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { isWakeWordEnabled, setWakeWordEnabled } from '@/hooks/useWakeWord';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { getTranslations, translateUIStrings } from '@/utils/translations';

const TEXT_SCALE_OPTIONS_KEYS = [
  { value: 0.85, labelKey: 'small' as const },
  { value: 1, labelKey: 'normal' as const },
  { value: 1.15, labelKey: 'large' as const },
  { value: 1.3, labelKey: 'extraLarge' as const },
];

type ThemeOption = {
  id: 'light' | 'dark' | 'system';
  nameKey: 'lightMode' | 'darkMode' | 'systemMode';
  descKey: 'lightDesc' | 'darkDesc' | 'systemDesc';
  icon: typeof Sun;
};

const themeOptions: ThemeOption[] = [
  { id: 'light', nameKey: 'lightMode', descKey: 'lightDesc', icon: Sun },
  { id: 'dark', nameKey: 'darkMode', descKey: 'darkDesc', icon: Moon },
  { id: 'system', nameKey: 'systemMode', descKey: 'systemDesc', icon: Monitor },
];

const Settings = () => {
  const navigate = useNavigate();
  const { preferences, updatePreference } = useUserPreferences();
  const { ui, update: updateUI, reset: resetUI } = useUICustomization();
  const [languageSearch, setLanguageSearch] = useState('');
  const [wakeWord, setWakeWord] = useState<boolean>(() => isWakeWordEnabled());
  const [reminders, setReminders] = useState<boolean>(() => localStorage.getItem('ai_chatbot_reminders_enabled') === 'true');
  const { selectedVoiceId, updateVoice, playText, isLoading } = useVoice();
  const { user } = useAuth();
  const push = usePushNotifications();
  const install = useInstallPrompt();
  const [emailConnected, setEmailConnected] = useState(false);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailConnecting, setEmailConnecting] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const [translating, setTranslating] = useState(false);
  const [showThinking, setShowThinking] = useState(
    () => localStorage.getItem('ai_chatbot_show_thinking') === 'true'
  );

  const handleShowThinkingChange = (enabled: boolean) => {
    setShowThinking(enabled);
    localStorage.setItem('ai_chatbot_show_thinking', String(enabled));
  };

  const t = getTranslations(preferences.language);

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
          toast.error(t.signOutError);
        } else {
          toast.success(t.emailActive + '!');
          loadEmailStatus();
        }
      } else {
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin + '/settings',
        });
        if (error) toast.error(t.error);
      }
    } catch {
      toast.error(t.error);
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
      toast.success(t.remove + '!');
    } else {
      toast.error(t.error);
    }
  };

  const handleSelectPersonality = (id: string) => {
    updatePreference('personality', id);
  };

  const handleSelectLanguage = async (code: string) => {
    updatePreference('language', code);
    // For non-hardcoded languages, trigger dynamic translation
    const hardcoded = ['tr', 'en', 'de', 'fr', 'es'];
    if (!hardcoded.includes(code)) {
      setTranslating(true);
      const result = await translateUIStrings(code);
      setTranslating(false);
      if (result) {
        forceUpdate();
      }
    }
  };

  const handleScreenShareToggle = (enabled: boolean) => {
    updatePreference('screen_share_enabled', enabled);
  };

  const handleTextScaleChange = (value: number) => {
    updatePreference('text_scale', value);
  };

  const handleHighContrastChange = (enabled: boolean) => {
    updatePreference('high_contrast', enabled);
  };

  const handleReduceMotionChange = (enabled: boolean) => {
    updatePreference('reduce_motion', enabled);
  };

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
            <h1 className="text-2xl font-bold text-foreground">{t.settings}</h1>
            <p className="text-muted-foreground text-sm">{t.customizeApp}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Language Selection - UI language */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                {t.language}
              </CardTitle>
              <CardDescription>
                {translating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t.languageDesc}
                  </span>
                ) : t.languageDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.searchLanguage}
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
                    isSelected={preferences.language === lang.code}
                    onSelect={() => handleSelectLanguage(lang.code)}
                  />
                ))}
                {filteredLanguages.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-4">{t.noResults}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Theme Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" />
                {t.theme}
              </CardTitle>
              <CardDescription>
                {t.themeDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <ThemeCard
                  key={option.id}
                  option={option}
                  isSelected={preferences.theme === option.id}
                  onSelect={() => updatePreference('theme', option.id)}
                  t={t}
                />
              ))}
            </CardContent>
          </Card>

          {/* UI Customization */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Arayüz Özelleştirme
              </CardTitle>
              <CardDescription>
                Vurgu rengi, yazı tipi, sohbet baloncuğu stili ve duvar kağıdı seç
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Accent Color */}
              <div>
                <div className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" /> Vurgu Rengi
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {(Object.keys(ACCENT_HSL) as AccentColor[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => updateUI('accent', c)}
                      title={ACCENT_LABELS[c]}
                      className={`h-10 rounded-lg border-2 transition-all ${
                        ui.accent === c ? 'border-foreground scale-105' : 'border-border/50 hover:border-foreground/50'
                      }`}
                      style={{ background: `hsl(${ACCENT_HSL[c].primary})` }}
                    >
                      {ui.accent === c && <Check className="w-4 h-4 text-white mx-auto drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div>
                <div className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" /> Yazı Tipi
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(FONT_LABELS) as FontFamily[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => updateUI('font', f)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        ui.font === f
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border/50 bg-secondary/30 hover:border-primary/50'
                      }`}
                      style={{
                        fontFamily:
                          f === 'inter' ? 'Inter, sans-serif' :
                          f === 'mono' ? 'JetBrains Mono, monospace' :
                          f === 'serif' ? 'Georgia, serif' : 'Outfit, sans-serif',
                      }}
                    >
                      <div className="text-sm font-medium">Aa Bb Cc</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{FONT_LABELS[f]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bubble Style */}
              <div>
                <div className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Sohbet Baloncuğu
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(BUBBLE_LABELS) as BubbleStyle[]).map((b) => (
                    <button
                      key={b}
                      onClick={() => updateUI('bubble', b)}
                      className={`p-3 border text-center transition-all ${
                        b === 'square' ? 'rounded-md' : b === 'minimal' ? 'rounded-sm' : 'rounded-2xl'
                      } ${
                        ui.bubble === b
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border/50 bg-secondary/30 hover:border-primary/50'
                      }`}
                    >
                      <div
                        className={`w-full h-6 bg-primary/30 mb-1 ${
                          b === 'square' ? 'rounded-sm' : b === 'minimal' ? 'rounded-none bg-transparent border-b border-primary/40' : 'rounded-xl'
                        }`}
                      />
                      <div className="text-[10px] text-muted-foreground">{BUBBLE_LABELS[b]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallpaper */}
              <div>
                <div className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" /> Arka Plan
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.keys(WALLPAPER_LABELS) as Wallpaper[]).map((w) => {
                    const bg =
                      w === 'aurora' ? 'radial-gradient(circle at 30% 30%, hsl(var(--primary)/0.5), transparent 60%), radial-gradient(circle at 70% 70%, hsl(var(--accent)/0.5), transparent 60%)' :
                      w === 'mesh' ? 'linear-gradient(135deg, hsl(var(--primary)/0.4), hsl(var(--accent)/0.3))' :
                      w === 'dots' ? 'radial-gradient(hsl(var(--primary)/0.6) 1.5px, transparent 1.5px) 0 0/10px 10px' :
                      w === 'sunset' ? 'linear-gradient(180deg, hsl(15 90% 55%/0.6), hsl(330 80% 50%/0.4))' :
                      'hsl(var(--secondary))';
                    return (
                      <button
                        key={w}
                        onClick={() => updateUI('wallpaper', w)}
                        title={WALLPAPER_LABELS[w]}
                        className={`h-14 rounded-lg border-2 transition-all relative overflow-hidden ${
                          ui.wallpaper === w ? 'border-primary scale-105' : 'border-border/50 hover:border-primary/50'
                        }`}
                        style={{ background: bg }}
                      >
                        {ui.wallpaper === w && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white drop-shadow" />
                          </span>
                        )}
                        <span className="absolute bottom-0 inset-x-0 text-[9px] bg-background/70 text-foreground py-0.5">
                          {WALLPAPER_LABELS[w]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={resetUI} className="w-full">
                <RotateCcw className="w-3.5 h-3.5 mr-2" /> Varsayılana Sıfırla
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                {t.textScale}
              </CardTitle>
              <CardDescription>
                {t.textScaleDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {TEXT_SCALE_OPTIONS_KEYS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleTextScaleChange(option.value)}
                    className={`p-3 rounded-lg border text-center transition-all duration-200 ${
                      preferences.text_scale === option.value
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
                      {t[option.labelKey]}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                {t.currentScale}: {Math.round(preferences.text_scale * 100)}%
              </p>
            </CardContent>
          </Card>

          {/* Accessibility */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                {t.accessibility}
              </CardTitle>
              <CardDescription>
                {t.accessibilityDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    {t.highContrast}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.highContrastDesc}
                  </div>
                </div>
                <Switch
                  checked={preferences.high_contrast}
                  onCheckedChange={handleHighContrastChange}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    {t.reduceMotion}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.reduceMotionDesc}
                  </div>
                </div>
                <Switch
                  checked={preferences.reduce_motion}
                  onCheckedChange={handleReduceMotionChange}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Show Tre's thinking (deep mode) */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Tre'nin Düşüncesini Göster
              </CardTitle>
              <CardDescription>
                Derin düşünme modu açıkken Tre'nin yanıtı oluştururken aklından geçenleri katlanabilir bir blok olarak gör.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm">Düşünce sürecini göster</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Sadece "Derin Düşünce" modu seçiliyken etkindir.
                  </div>
                </div>
                <Switch
                  checked={showThinking}
                  onCheckedChange={handleShowThinkingChange}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Swipe to Delete Toggle */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-primary" />
                {t.swipeToDelete}
              </CardTitle>
              <CardDescription>
                {t.swipeToDeleteDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm">{t.enableSwipe}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.enableSwipeDesc}
                  </div>
                </div>
                <Switch
                  checked={preferences.swipe_to_delete_enabled}
                  onCheckedChange={(v) => updatePreference('swipe_to_delete_enabled', v)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Screen Share Toggle */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScreenShare className="h-5 w-5 text-primary" />
                {t.screenShare}
              </CardTitle>
              <CardDescription>
                {t.screenShareDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm">{t.enableScreenShare}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.enableScreenShareDesc}
                  </div>
                </div>
                <Switch
                  checked={preferences.screen_share_enabled}
                  onCheckedChange={handleScreenShareToggle}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Wake Word "Hey Tre" */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                "Hey Tre" Uyandırma
              </CardTitle>
              <CardDescription>
                Aktifken mikrofon sürekli dinler; "Hey Tre" dediğinde sesli sohbet otomatik açılır.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm">Sesle Uyandırmayı Etkinleştir</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Mikrofon izni gereklidir. Tarayıcı sekmesi açık olmalıdır.
                  </div>
                </div>
                <Switch
                  checked={wakeWord}
                  onCheckedChange={async (v) => {
                    if (v) {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach((t) => t.stop());
                      } catch {
                        toast.error('Mikrofon izni reddedildi');
                        return;
                      }
                    }
                    setWakeWord(v);
                    setWakeWordEnabled(v);
                    toast.success(v ? '"Hey Tre" dinleniyor' : 'Uyandırma kapatıldı');
                  }}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Hatırlatıcılar
              </CardTitle>
              <CardDescription>
                Aktifken Tre sohbette hatırlatıcı kurabilir ve zamanı geldiğinde bildirim gönderir. Bildirimlerin de açık olması gerekir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div>
                  <div className="font-medium text-foreground text-sm">Hatırlatıcı iznini etkinleştir</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Örn: "Yarın 09:00'da toplantıyı hatırlat" dediğinde Tre hatırlatıcı kurar.
                  </div>
                </div>
                <Switch
                  checked={reminders}
                  onCheckedChange={(v) => {
                    setReminders(v);
                    localStorage.setItem('ai_chatbot_reminders_enabled', String(v));
                    if (v && !push.subscribed) {
                      toast.info('Hatırlatıcılar açıldı. Bildirim almak için "Bildirim ile Sohbet" bölümünden push bildirimlerini de aç.');
                    } else {
                      toast.success(v ? 'Hatırlatıcılar aktif' : 'Hatırlatıcılar kapatıldı');
                    }
                  }}
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
                {t.emailAccess}
              </CardTitle>
              <CardDescription>
                {t.emailAccessDesc}
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
                        <div className="font-medium text-foreground text-sm">{t.emailActive}</div>
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
                      {t.remove}
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70 px-1">
                    <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>{t.emailSecurityNote}</p>
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
                        <div className="font-medium text-foreground text-sm">{t.notConnected}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t.connectGoogleDesc}
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
                      {t.connectGoogle}
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70 px-1">
                    <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>{t.accountSecurityNote}</p>
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
                {t.voiceChat}
              </CardTitle>
              <CardDescription>
                {t.voiceChatDesc}
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
                  <div className="font-medium text-foreground text-sm">{t.startVoiceChat}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.startVoiceChatDesc}
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
                {t.voiceSelection}
              </CardTitle>
              <CardDescription>
                {t.voiceSelectionDesc}
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
                  testLabel={t.test}
                />
              ))}
            </CardContent>
          </Card>

          {/* Personality Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                {t.botPersonality}
              </CardTitle>
              <CardDescription>
                {t.botPersonalityDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {personalities.map((personality) => (
                <PersonalityCard
                  key={personality.id}
                  personality={personality}
                  isSelected={preferences.personality === personality.id}
                  onSelect={() => handleSelectPersonality(personality.id)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Bildirim ile Sohbet */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Bildirim ile Sohbet
              </CardTitle>
              <CardDescription>
                Uygulamayı açmadan, bildirimin içindeki cevap kutusundan Tre ile konuşabilirsin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {push.blockedInPreview && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                  ⚠️ Bu özellik Lovable önizlemesinde çalışmaz. Yayınlanmış sürümde
                  (<span className="font-mono">tre-ai.lovable.app</span>) veya ana ekrana yüklenmiş PWA'da test et.
                </div>
              )}
              {!push.supported && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                  Tarayıcın push bildirimlerini desteklemiyor.
                </div>
              )}
              {push.supported && (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">Push bildirimleri</div>
                      <div className="text-xs text-muted-foreground">
                        Durum: {push.subscribed ? 'Aktif' : 'Kapalı'} • İzin: {push.permission}
                      </div>
                    </div>
                    <Switch
                      checked={push.subscribed}
                      disabled={push.loading || push.blockedInPreview}
                      onCheckedChange={(c) => (c ? push.subscribe() : push.unsubscribe())}
                    />
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!push.subscribed || push.loading}
                    onClick={push.sendTest}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Test bildirimi gönder
                  </Button>

                  <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
                    <p>• <b>Android Chrome / Edge:</b> Bildirimi aşağı kaydırıp genişlet, "Cevap yaz" kutusu çıkar. Yazıp gönderdiğinde Tre yine bildirim olarak cevaplar.</p>
                    <p>• <b>Android Firefox / Samsung Internet:</b> Bildirim gelir ama bildirim çubuğundan metin cevabı çoğunlukla desteklenmez. Bildirime dokun, uygulama açılsın, oradan cevap ver. (Tam destek için Chrome/Edge öneririz.)</p>
                    <p>• <b>iOS:</b> Bildirime tıklayınca uygulama açılır. Cevap kutusu iOS'ta desteklenmez. Ana ekrana yüklenmiş PWA gerekir.</p>
                    <p>• <b>Masaüstü:</b> Sekme kapalı olsa da bildirim gelir; cevap kutusu tarayıcıya göre değişir.</p>
                  </div>
                  {typeof navigator !== 'undefined' && /Firefox|FxiOS/i.test(navigator.userAgent) && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-[11px] text-yellow-200/90">
                      Firefox kullandığını algıladık. Bildirim çubuğundan doğrudan cevap yazma özelliği Firefox'ta desteklenmiyor olabilir; bildirime dokunup uygulamadan cevap vermen gerekir.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Otomatik Bildirimler & Temizlik */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Otomatik Hatırlatma & Temizlik
              </CardTitle>
              <CardDescription>
                Sabah/akşam bildirimleri, uzun sessizlik uyarısı ve eski sohbetlerin otomatik temizliği. Cihazının saatine göre çalışır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sabah / Akşam */}
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Sabah / Akşam bildirimi</div>
                    <div className="text-xs text-muted-foreground">Belirlediğin saatlerde Tre sana seslenir.</div>
                  </div>
                  <Switch
                    checked={scheduler.settings.dailyEnabled}
                    onCheckedChange={(c) => scheduler.update('dailyEnabled', c)}
                  />
                </div>
                {scheduler.settings.dailyEnabled && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Sabah saati</label>
                        <Input
                          type="time"
                          value={scheduler.settings.morningTime}
                          onChange={(e) => scheduler.update('morningTime', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Akşam saati</label>
                        <Input
                          type="time"
                          value={scheduler.settings.eveningTime}
                          onChange={(e) => scheduler.update('eveningTime', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Sabah mesajı</label>
                      <Input
                        value={scheduler.settings.morningText}
                        onChange={(e) => scheduler.update('morningText', e.target.value)}
                        placeholder="Günaydın!"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Akşam mesajı</label>
                      <Input
                        value={scheduler.settings.eveningText}
                        onChange={(e) => scheduler.update('eveningText', e.target.value)}
                        placeholder="İyi akşamlar!"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sessizlik */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Uzun sessizlik bildirimi</div>
                  <div className="text-xs text-muted-foreground">2 gündür sohbet yoksa "Bir şey mi oldu?" bildirimi gelir.</div>
                </div>
                <Switch
                  checked={scheduler.settings.inactivityEnabled}
                  onCheckedChange={(c) => scheduler.update('inactivityEnabled', c)}
                />
              </div>

              {/* Otomatik temizlik */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Otomatik temizlik</div>
                  <div className="text-xs text-muted-foreground">30 gündür kullanılmayan sohbetler günlük olarak silinir. Hafıza ve ayarların korunur.</div>
                </div>
                <Switch
                  checked={scheduler.settings.autoCleanEnabled}
                  onCheckedChange={(c) => {
                    scheduler.update('autoCleanEnabled', c);
                    if (c) toast.info('30 günden eski sohbetler bundan sonra otomatik silinecek.');
                  }}
                />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Bildirimlerin gelmesi için yukarıdaki push bildirimlerinin açık olması gerekir. Uygulama tamamen kapalıyken bildirim gecikebilir; uygulama açıldığında kontrol tekrar yapılır.
              </p>
            </CardContent>
          </Card>



          {/* Uygulamayı Yükle (PWA) */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Uygulamayı Yükle
              </CardTitle>
              <CardDescription>
                Tre'yi telefonunun ana ekranına ekle, tam ekran ve hızlı erişim.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {install.installed ? (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                  ✓ Uygulama yüklü olarak çalışıyor.
                </div>
              ) : install.canInstall ? (
                <Button className="w-full" onClick={install.promptInstall}>
                  <Download className="h-4 w-4 mr-2" />
                  Ana ekrana ekle
                </Button>
              ) : install.isIOS ? (
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-xs text-muted-foreground leading-relaxed">
                  iOS'ta yüklemek için: Safari'de <b>Paylaş</b> butonuna dokun → <b>Ana Ekrana Ekle</b>.
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-xs text-muted-foreground leading-relaxed">
                  Tarayıcı menüsünden <b>"Ana ekrana ekle"</b> / <b>"Uygulamayı yükle"</b> seçeneğini kullan. Bu özellik yalnızca yayınlanmış sürümde (tre-ai.lovable.app) görünür.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tre Ne Yapabilir? */}
          <Button
            asChild
            variant="outline"
            className="w-full justify-between border-border/50 h-auto py-3"
          >
            <Link to="/capabilities">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Tre Ne Yapabilir?
              </span>
              <span className="text-xs text-muted-foreground">Tüm yetenekler →</span>
            </Link>
          </Button>

          {/* Yıldızlı Mesajlar */}
          <Button
            asChild
            variant="outline"
            className="w-full justify-between border-border/50 h-auto py-3"
          >
            <Link to="/starred">
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">⭐</span>
                Yıldızlı Mesajlar
              </span>
              <span className="text-xs text-muted-foreground">Kaydedilenler →</span>
            </Link>
          </Button>


          {/* Geri Bildirim */}
          <Button
            asChild
            variant="outline"
            className="w-full border-border/50"
          >
            <a
              href="https://forms.gle/csci2Ad2BPNy5pfA6"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Geri Bildirim Gönder
            </a>
          </Button>
        </div>

      </div>
    </div>
  );
};

interface ThemeCardProps {
  option: ThemeOption;
  isSelected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof getTranslations>;
}

const ThemeCard = ({ option, isSelected, onSelect, t }: ThemeCardProps) => {
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
      <div className="font-medium text-foreground text-xs sm:text-sm">{t[option.nameKey]}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{t[option.descKey]}</div>
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
  testLabel: string;
}

const VoiceCard = ({ voice, isSelected, onSelect, onTest, isLoading, testLabel }: VoiceCardProps) => {
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
            {testLabel}
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
