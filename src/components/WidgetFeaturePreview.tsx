import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, Bell, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type WidgetStatus = 'idle' | 'listening' | 'thinking' | 'answered';

const STATUS_TEXT: Record<WidgetStatus, string> = {
  idle: 'Dokun ve Konuş',
  listening: 'Dinleniyor...',
  thinking: 'Yanıt Hazırlanıyor...',
  answered: 'Yanıt bildirime gönderildi',
};

const INFO = [
  {
    title: 'Ne Yapar?',
    desc: 'Ana ekrana eklenen kare widget, uygulamayı açmadan tek dokunuşla sesli komut alır ve Tre’nin yanıtını bildirim olarak gösterir.',
  },
  {
    title: 'Nasıl Çalışır?',
    desc: 'Widget dokunuşu Web Speech API ile mikrofonu açar, konuşma metne çevrilir, Tre yanıtı hazırlar ve Notification API üzerinden bildirim düşer.',
  },
  {
    title: 'Neden Önemli?',
    desc: 'Eller meşgulken, yürürken veya araç kullanırken uygulamayı açmadan hızlı soru–cevap imkânı sağlar.',
  },
];

const TECH = ['Web Speech API', 'Notification API', 'Service Worker', 'PWA Shortcuts', 'manifest.webmanifest'];

const WidgetFeaturePreview = () => {
  const [status, setStatus] = useState<WidgetStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const recRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const supported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const showNotification = useCallback(async (title: string, body: string) => {
    if (typeof Notification === 'undefined') {
      toast.info(body);
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm !== 'granted') {
      toast.error('Bildirim izni verilmedi');
      return;
    }
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'tre-widget',
        });
      } else {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
    } catch {
      toast.info(body);
    }
  }, []);

  const handleResult = useCallback(
    async (text: string) => {
      setStatus('thinking');
      const reply = `“${text}” sorunu aldım. Tre yanıtı hazır — sohbeti açarak devam edebilirsin.`;
      await new Promise((r) => setTimeout(r, 900));
      setAnswer(reply);
      await showNotification('Tre', reply);
      setStatus('answered');
    },
    [showNotification]
  );

  const startListening = useCallback(async () => {
    if (status === 'listening') {
      try { recRef.current?.stop(); } catch { /* noop */ }
      return;
    }
    if (!supported) {
      toast.error('Tarayıcın konuşma tanımayı desteklemiyor');
      return;
    }
    setTranscript('');
    setAnswer('');
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'tr-TR';
    rec.interimResults = true;
    rec.continuous = false;
    recRef.current = rec;

    let finalText = '';
    rec.onstart = () => setStatus('listening');
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setTranscript(finalText || interim);
    };
    rec.onerror = (e: any) => {
      setStatus('idle');
      toast.error(e?.error === 'not-allowed' ? 'Mikrofon izni reddedildi' : 'Ses algılanamadı');
    };
    rec.onend = () => {
      const text = (finalText || '').trim();
      if (text) handleResult(text);
      else setStatus('idle');
    };
    try {
      rec.start();
    } catch {
      setStatus('idle');
    }
  }, [status, supported, handleResult]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  const listening = status === 'listening';
  const thinking = status === 'thinking';

  return (
    <main className="min-h-[100dvh] w-full px-4 py-6 pb-[env(safe-area-inset-bottom)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link to="/capabilities" aria-label="Yeteneklere dön">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground text-glow sm:text-2xl">
              2. Mobil Ana Ekran Widget’ı &amp; Sesli Komut
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Ana ekrandan tek tıkla sesli komut dinleyen ve yanıtı arka planda bildirim olarak sunan Widget altyapısı.
            </p>
          </div>
        </div>

        {/* Widget card */}
        <section className="flex justify-center">
          <div className="relative aspect-square w-full max-w-[280px] rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl shadow-glow">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="font-semibold text-primary">Tre</span>
              <span>Widget</span>
            </div>

            <div className="mt-2 flex h-[calc(100%-2.5rem)] flex-col items-center justify-center gap-4">
              <button
                type="button"
                onClick={startListening}
                aria-label="Sesli komut ver"
                className={`relative flex h-20 w-20 items-center justify-center rounded-full border transition-all ${
                  listening
                    ? 'border-primary bg-primary/20 text-primary shadow-glow scale-105'
                    : 'border-primary/30 bg-primary/10 text-primary hover:border-primary/60 hover:shadow-glow'
                }`}
              >
                {listening && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                )}
                {thinking ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-8 w-8" />}
              </button>

              <p className={`text-center text-xs font-medium ${listening || thinking ? 'text-primary' : 'text-muted-foreground'}`}>
                {STATUS_TEXT[status]}
              </p>
              {transcript && (
                <p className="line-clamp-2 px-2 text-center text-[11px] text-foreground/80">“{transcript}”</p>
              )}
            </div>
          </div>
        </section>

        {answer && (
          <div className="mx-auto mt-4 flex max-w-[520px] items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-foreground/90">{answer}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span>Mikrofon: {supported ? 'destekleniyor' : 'desteklenmiyor'}</span>
          <span className="opacity-40">•</span>
          <span>Bildirim izni: {notifPerm}</span>
          {notifPerm === 'default' && (
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => Notification.requestPermission().then(setNotifPerm)}>
              İzin ver
            </Button>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {INFO.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-foreground">{c.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {TECH.map((t) => (
            <span key={t} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] text-primary">
              {t}
            </span>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Aşağı kaydır"
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="text-muted-foreground"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
        <div ref={bottomRef} />
      </div>
    </main>
  );
};

export default WidgetFeaturePreview;
