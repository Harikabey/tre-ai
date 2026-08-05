import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "idle" | "listening" | "thinking";

const STATUS_TEXT: Record<Status, string> = {
  idle: "Dokun ve Konuş",
  listening: "Dinleniyor...",
  thinking: "Yanıt Hazırlanıyor...",
};

const WidgetPreview = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch(() => {});
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const notify = (body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Tre", { body, icon: "/icon-192.png" });
    }
  };

  const ask = async (text: string) => {
    setStatus("thinking");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no-session");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
        },
      );
      const raw = await res.text();
      let out = "";
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") break;
        try {
          out += JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
        } catch {}
      }
      const final = out.trim() || "Şu an yanıt veremedim.";
      setReply(final);
      notify(final.slice(0, 300));
    } catch {
      const msg = "Yanıt alınamadı. Giriş yapmış olduğundan emin ol.";
      setReply(msg);
      notify(msg);
    } finally {
      setStatus("idle");
    }
  };

  const handleMic = () => {
    if (status !== "idle") return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
    rec.onresult = (e: any) => {
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
