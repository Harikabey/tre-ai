import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useVoice } from '@/hooks/useVoice';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import aiLogo from '@/assets/ai-logo.jpg';

interface VoiceMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

const moodColors: Record<string, string> = {
  mutlu: 'from-green-400/40 to-emerald-500/40',
  üzgün: 'from-blue-400/40 to-indigo-500/40',
  kızgın: 'from-red-400/40 to-orange-500/40',
  endişeli: 'from-yellow-400/40 to-amber-500/40',
  heyecanlı: 'from-pink-400/40 to-rose-500/40',
  sakin: 'from-teal-400/40 to-cyan-500/40',
  nötr: 'from-primary/40 to-accent/40',
};

const VoiceChat = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { playText, stopAudio, isPlaying, isLoading: ttsLoading, selectedVoiceId } = useVoice();
  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const haptic = useHapticFeedback();
  
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Pulse animation
  useEffect(() => {
    if (!isListening) { setPulseIntensity(0); return; }
    const interval = setInterval(() => setPulseIntensity(Math.random() * 0.5 + 0.5), 200);
    return () => clearInterval(interval);
  }, [isListening]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // When user stops listening and has transcript, send it
  useEffect(() => {
    if (!isListening && transcript && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript;
      handleSendVoiceMessage(transcript);
    }
  }, [isListening, transcript]);

  const handleSendVoiceMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    
    const userMsg: VoiceMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    resetTranscript();
    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı');

      const personality = localStorage.getItem('ai_chatbot_personality') || 'friendly';
      const language = localStorage.getItem('ai_chatbot_language') || 'tr';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text.trim(),
            personality,
            language,
            voiceMode: true,
            thinkingMode: 'fast',
            conversationHistory: messages.slice(-6).map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content,
            })),
          }),
        }
      );

      if (!response.ok) throw new Error('Yanıt alınamadı');
      
      const data = await response.json();
      const botReply = data.reply || data.response || 'Yanıt alınamadı.';

      const botMsg: VoiceMessage = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: botReply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);

      // Auto-speak the response
      if (autoSpeak) {
        await playText(botReply);
      }
    } catch (error) {
      console.error('Voice chat error:', error);
      toast.error('Sesli sohbet hatası');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      if (isPlaying) stopAudio();
      haptic.voiceActivate();
      startListening();
    }
  }, [isListening, startListening, stopListening, haptic, isPlaying, stopAudio]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const gradientClass = moodColors['nötr'];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background bg-grid flex flex-col">
      <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 p-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Sesli Sohbet</h1>
          <p className="text-xs text-muted-foreground">
            {isListening ? 'Dinleniyor...' : isProcessing ? 'Düşünüyor...' : isPlaying ? 'Konuşuyor...' : 'Mikrofona basarak konuşun'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={autoSpeak ? 'text-primary' : 'text-muted-foreground'}
          >
            {autoSpeak ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          <Link to="/settings">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-hidden" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/50 shadow-glow">
              <img src={aiLogo} alt="Tre" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Sesli Sohbete Hoş Geldiniz</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Aşağıdaki mikrofon butonuna basarak konuşmaya başlayın
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary/70 text-foreground border border-border/50 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                    <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-secondary/70 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Live transcript */}
      {isListening && transcript && (
        <div className="relative z-10 px-4 pb-2">
          <div className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-muted-foreground italic">
            {transcript}
          </div>
        </div>
      )}

      {/* Voice Control Area */}
      <div className="relative z-10 p-6 pb-safe flex flex-col items-center gap-4 border-t border-border/50 bg-card/30 backdrop-blur-sm safe-area-inset-bottom">
        {/* Pulse animation behind button */}
        <div className="relative flex items-center justify-center">
          {isListening && [1, 2, 3].map((ring) => (
            <div
              key={ring}
              className={`absolute rounded-full bg-gradient-to-r ${gradientClass} animate-ping`}
              style={{
                width: `${60 + ring * 30}px`,
                height: `${60 + ring * 30}px`,
                animationDuration: `${1.5 + ring * 0.5}s`,
                animationDelay: `${ring * 0.2}s`,
                opacity: 0.3 - ring * 0.08,
              }}
            />
          ))}
          
          {isListening && (
            <div
              className={`absolute w-20 h-20 rounded-full bg-gradient-to-r ${gradientClass} transition-transform duration-200`}
              style={{ transform: `scale(${1 + pulseIntensity * 0.3})`, opacity: 0.4 }}
            />
          )}

          <Button
            onClick={toggleListening}
            disabled={!isSupported || isProcessing || ttsLoading}
            size="icon"
            className={`relative z-10 w-16 h-16 rounded-full transition-all duration-300 ${
              isListening
                ? 'bg-destructive hover:bg-destructive/90 shadow-[0_0_30px_hsl(0_84%_60%_/_0.4)] scale-110'
                : 'bg-primary hover:bg-primary/90 shadow-glow hover:shadow-[0_0_40px_hsl(180_100%_50%_/_0.5)]'
            }`}
          >
            {isListening ? (
              <MicOff className="w-7 h-7" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {!isSupported
            ? 'Tarayıcınız ses tanımayı desteklemiyor'
            : isListening
            ? 'Konuşmayı durdurmak için tekrar basın'
            : isProcessing
            ? 'Yanıt bekleniyor...'
            : 'Mikrofona basarak konuşmaya başlayın'}
        </p>
      </div>
    </div>
  );
};

export default VoiceChat;
