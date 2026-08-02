import { ArrowDown, Share2 } from "lucide-react";
import { ReactNode } from "react";

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[0.85em] text-primary">
    {children}
  </code>
);

const ROWS: { label: string; text: ReactNode }[] = [
  {
    label: "Ne Yapar?",
    text: "Kullanıcı başka bir uygulamadan (tarayıcı, dosya yöneticisi) bir metin, link veya dosya paylaşırken Tre'yi hedef olarak seçebilir.",
  },
  {
    label: "Nasıl Çalışır?",
    text: (
      <>
        <Code>manifest.json</Code> dosyasına <Code>share_target</Code> eklenir. Tre, paylaşılan
        içeriği alır ve işler.
      </>
    ),
  },
  {
    label: "Neden Önemli?",
    text: "Tre, kullanıcının diğer uygulamalarla etkileşimine dahil olur.",
  },
];

const TECH = ["Share Target API", "manifest.json", "içerik işleme"];

const ShareTargetFeaturePreview = () => {
  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  return (
    <section className="relative w-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60 text-primary">
            <Share2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              4. Sistem Paylaşım Menüsü (Share Target)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kullanıcının cihazındaki paylaşım menüsüne doğrudan entegre olan altyapı.
            </p>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-xl shadow-glow-lg">
          {ROWS.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-1 gap-1 border-b border-border/60 p-4 sm:grid-cols-[180px_1fr] sm:gap-4 sm:p-5"
            >
              <div className="text-sm font-semibold text-primary">{row.label}</div>
              <p className="text-sm leading-relaxed text-foreground/90 overflow-wrap-anywhere">
                {row.text}
              </p>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[180px_1fr] sm:gap-4 sm:p-5">
            <div className="text-sm font-semibold text-primary">Teknik İhtiyaçlar</div>
            <div className="flex flex-wrap gap-2">
              {TECH.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={scrollToBottom}
        aria-label="Aşağı kaydır"
        className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/80 text-primary backdrop-blur-md transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        <ArrowDown className="h-5 w-5" />
      </button>
    </section>
  );
};

export default ShareTargetFeaturePreview;
