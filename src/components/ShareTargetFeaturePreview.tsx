import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ShareTargetFeaturePreview = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const initial = useMemo(() => {
    const title = params.get("title") || "";
    const text = params.get("text") || "";
    const url = params.get("url") || "";
    return [title, text, url].filter(Boolean).join("\n").trim();
  }, [params]);

  const [content, setContent] = useState(initial);

  useEffect(() => setContent(initial), [initial]);

  const handleAsk = () => {
    const value = content.trim();
    if (!value) return;
    navigate("/", { state: { sharedText: value } });
  };

  return (
    <section className="flex min-h-[100dvh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60 text-primary">
            <Share2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Tre'ye Paylaşıldı
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paylaşım menüsünden gelen içeriği düzenleyip Tre'ye sorabilirsin.
            </p>
          </div>
        </header>

        <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-xl shadow-glow-lg sm:p-5">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Paylaşılan içerik
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paylaşılan metin veya bağlantı burada görünür..."
            className="min-h-[140px] resize-none break-words text-sm"
          />

          <Button
            onClick={handleAsk}
            disabled={!content.trim()}
            className="mt-4 w-full gap-2"
            size="lg"
          >
            <Sparkles className="h-4 w-4" />
            Tre'ye Sor / Analiz Et
          </Button>

          <Button
            variant="ghost"
            className="mt-2 w-full text-muted-foreground"
            onClick={() => navigate("/")}
          >
            Sohbete dön
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ShareTargetFeaturePreview;
