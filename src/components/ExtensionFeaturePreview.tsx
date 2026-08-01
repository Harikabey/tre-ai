import { ArrowDown, Puzzle } from "lucide-react";

const ROWS: { label: string; text: string }[] = [
  {
    label: "Ne Yapar?",
    text: "Kullanıcı herhangi bir web sayfasında metin seçip sağ tıklayarak 'Tre'ye Sor' der. Tre metni analiz eder, cevap verir.",
  },
  {
    label: "Nasıl Çalışır?",
    text: "Chrome/Edge/Firefox uzantısı geliştirilir. Seçilen metin veya sayfa URL'si Tre API'sine gönderilir. Cevap pop-up veya bildirim olarak gelir.",
  },
  {
    label: "Neden Önemli?",
    text: "Kullanıcı sayfadan ayrılmadan bilgi alır. Tre, araştırma yaparken yanındadır.",
  },
];

const TECH = ["Manifest V3", "background script", "popup UI", "Tre API entegrasyonu"];

const ExtensionFeaturePreview = () => {
  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  return (
    <section className="relative w-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60 text-primary">
            <Puzzle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              1. Tarayıcı Uzantısı (Web Extension)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tre'yi tarayıcının her sekmesine taşıyan hafif entegrasyon katmanı.
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

export default ExtensionFeaturePreview;
