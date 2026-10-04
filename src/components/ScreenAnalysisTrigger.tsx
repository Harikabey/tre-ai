import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MonitorUp, X } from "lucide-react";

/** URL ile tetiklendiğinde ekranı yakalar ve analiz sonucunu sayfada gösterir. */
const PARAM = "screenAnalyze";

const ScreenAnalysisTrigger = () => {
  const [status, setStatus] = useState<"idle" | "capturing" | "analyzing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const startedRef = useRef(false);

  const run = useCallback(async () => {
    setStatus("capturing");
    setMessage("Ekran yakalanıyor...");
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Ekran yakalama bu ortamda desteklenmiyor.");
      }
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 300));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Kare alınamadı.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // İlk kare alındı → stream'i hemen kapat
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      setStatus("analyzing");
      setMessage("Tre analiz ediyor...");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${(await (await import("@/integrations/supabase/client")).supabase.auth.getSession()).data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          imageUrl: dataUrl,
          prompt: "Analyze this screen. Ekranda ne olduğunu kısaca ve net şekilde Türkçe açıkla.",
        }),
      });
      if (!res.ok) throw new Error("Analiz isteği başarısız.");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const analysis: string = data.analysis || "Analiz sonucu boş döndü.";
      setStatus("done");
      setMessage(analysis);
    } catch (e: any) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const msg = e?.name === "NotAllowedError" ? "Ekran paylaşımı izni verilmedi." : e?.message || "Analiz başarısız.";
      setStatus("error");
      setMessage(msg);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(PARAM) !== "1" || startedRef.current) return;
    startedRef.current = true;

    // URL'i temizle (yeniden tetiklenmesin)
    params.delete(PARAM);
    const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", clean);

    run();
  }, [run]);

  if (status === "idle") return null;

  const busy = status === "capturing" || status === "analyzing";

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[92vw] max-w-md -translate-x-1/2">
      <div className="rounded-xl border border-border/60 bg-card/95 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-start gap-3">
          {busy ? (
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
          ) : (
            <MonitorUp className={`mt-0.5 h-5 w-5 shrink-0 ${status === "error" ? "text-destructive" : "text-primary"}`} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Ekran Analizi</p>
            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {message}
            </p>
          </div>
          {!busy && (
            <button
              onClick={() => setStatus("idle")}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScreenAnalysisTrigger;
