// FILE: src/components/WidgetPreview.tsx
import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readModelSelection } from "@/hooks/useModelSelection";
import { requestChatCompletion } from "@/lib/chatRequest";
import { useLocalModel } from "@/hooks/useLocalModel";
import { detectWebGPU } from "@/hooks/useWebGPU";

type Status = "idle" | "listening" | "thinking";

const STATUS_TEXT: Record<Status, string> = {
  idle: "Dokun ve Konuş",
  listening: "Dinleniyor...",
  thinking: "Yanıt Hazırlanıyor...",
};

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript?: string }>>;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const WidgetPreview = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const {
    isLoading: isLocalModelLoading,
    isReady: isLocalModelReady,
    generateResponse: generateLocalResponse,
  } = useLocalModel();

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch((error: unknown) => console.warn("Microphone permission check failed", error));
  }, []);

  const ask = async (text: string) => {
    setStatus("thinking");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no-session");
      const modelSelection = readModelSelection();
      if (modelSelection.provider === 'local') {
        const gpuStatus = detectWebGPU();
        if (!gpuStatus.isSupported) {
          throw new Error(gpuStatus.errorMessage ?? 'Bu tarayıcı WebGPU desteklemiyor.');
        }
        if (isLocalModelLoading) {
          throw new Error('Model yükleniyor. Lütfen yüklemenin tamamlanmasını bekle.');
        }
        if (!isLocalModelReady) {
          throw new Error('Yerel model henüz yüklenmedi. Lütfen Ayarlar’dan modeli indirin.');
        }
        const localReply = await generateLocalResponse([{ role: 'user', content: text }]);
        setReply(localReply);
        return;
      }

      const res = await requestChatCompletion({
        modelSelection,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          messages: [{ role: "user", content: text }],
        },
      });
      if (!res.ok) {
        const errorData: unknown = await res.json().catch(() => null);
        const isInvalidApiKey =
          typeof errorData === 'object' &&
          errorData !== null &&
          'code' in errorData &&
          errorData.code === 'INVALID_API_KEY';
        throw new Error(isInvalidApiKey ? 'Anahtar geçersiz' : 'Yanıt alınamadı');
      }
      const raw = await res.text();
      let out = "";
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") break;
        try {
          const chunk: unknown = JSON.parse(payload);
          if (
            typeof chunk === 'object' &&
            chunk !== null &&
            'choices' in chunk &&
            Array.isArray(chunk.choices)
          ) {
            const delta = chunk.choices[0]?.delta;
            if (
              typeof delta === 'object' &&
              delta !== null &&
              'content' in delta &&
              typeof delta.content === 'string'
            ) {
              out += delta.content;
            }
          }
        } catch {
          continue;
        }
      }
      const final = out.trim() || "Şu an yanıt veremedim.";
      setReply(final);
    } catch (error) {
      const isInvalidApiKey = error instanceof Error && error.message === 'Anahtar geçersiz';
      const msg = isInvalidApiKey
        ? 'Anahtar geçersiz'
        : "Yanıt alınamadı. Giriş yapmış olduğundan emin ol.";
      if (isInvalidApiKey) toast.error(msg);
      setReply(msg);
    } finally {
      setStatus("idle");
    }
  };

  const handleMic = () => {
    if (status !== "idle") return;
    const speechWindow = window as unknown as SpeechRecognitionWindow;
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) {
      setReply("Bu tarayıcı sesli komutu desteklemiyor.");
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "tr-TR";
    rec.interimResults = false;
    rec.continuous = false;
    setTranscript("");
    setReply("");
    rec.onstart = () => setStatus("listening");
    rec.onerror = () => setStatus("idle");
    rec.onend = () => setStatus((s) => (s === "listening" ? "idle" : s));
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (!text) return;
      setTranscript(text);
      ask(text);
    };
    rec.start();
  };

  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Mobil Ana Ekran Widget'ı & Sesli Komut
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ana ekrandan sesli komut dinleyen, yanıtı bildirim olarak sunan widget
          </p>
        </header>

        <div className="mx-auto aspect-square w-full max-w-xs rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-xl shadow-glow-lg">
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <button
              type="button"
              onClick={handleMic}
              aria-label="Sesli komut"
              className={`flex h-24 w-24 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary transition-all hover:bg-primary/25 ${
                status === "listening" ? "animate-pulse shadow-glow-lg" : "shadow-glow"
              }`}
            >
              <Mic className="h-10 w-10" />
            </button>
            <p className="text-sm font-medium text-foreground">{STATUS_TEXT[status]}</p>
            {transcript && (
              <p className="line-clamp-2 text-center text-xs text-muted-foreground">"{transcript}"</p>
            )}
          </div>
        </div>

        {reply && (
          <div className="mt-6 rounded-2xl border border-border bg-card/50 p-4 text-sm leading-relaxed text-foreground/90">
            {reply}
          </div>
        )}
      </div>
    </main>
  );
};

export default WidgetPreview;
