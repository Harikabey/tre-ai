import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ROWS: { label: string; text: string }[] = [
  {
    label: "Ne Yapar?",
    text: "Bilgisayarda bir .txt, .md, .pdf veya .docx dosyasına sağ tıklayıp 'Tre ile aç' dediğinde dosya doğrudan Tre'de açılır ve analiz edilir.",
  },
  {
    label: "Nasıl Çalışır?",
    text: "manifest.json içindeki file_handlers tanımı ile işletim sistemi Tre'yi bu dosya türleri için kayıtlı uygulama olarak tanır. Açılan dosya window.launchQueue üzerinden yakalanır.",
  },
  {
    label: "Neden Önemli?",
    text: "Kullanıcı dosya yükleme adımıyla uğraşmaz. Belge, masaüstünden tek tıkla Tre'nin analiz ekranına düşer.",
  },
];

const TECH = ["File Handling API", "manifest.json", "dosya okuma yetkisi"];

const FileHandlerFeaturePreview = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const lq = (window as any).launchQueue;
    if (!lq?.setConsumer) return;
    lq.setConsumer(async (params: any) => {
      if (!params?.files?.length) return;
      try {
        const handle = params.files[0];
        const f = await handle.getFile();
        setFile(f);
      } catch {
        toast.error("Dosya açılamadı");
      }
    });
  }, []);

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const isText = /\.(txt|md)$/i.test(file.name) || file.type.startsWith("text/");
      let payload: string;
      if (isText) {
        const text = (await file.text()).slice(0, 20000);
        payload = `📄 **${file.name}** dosyasını analiz et:\n\n${text}`;
      } else {
        const dataUrl: string = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        payload = `📄 **${file.name}** dosyasını analiz et:\n\n[Ek dosya: ${file.name}](${dataUrl})`;
      }
      navigate("/", { state: { sharedText: payload } });
    } catch {
      toast.error("Dosya okunamadı");
    } finally {
      setBusy(false);
    }
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  return (
    <section className="relative w-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Masaüstü Dosya İşleme (File Handler)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Belgeleri doğrudan okuyup analiz eden altyapı
            </p>
          </div>
        </header>

        {file && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium text-primary">Açılan dosya</div>
              <p className="truncate text-sm text-foreground">{file.name}</p>
            </div>
            <Button onClick={analyze} disabled={busy} className="shrink-0">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analiz Et
            </Button>
          </div>
        )}

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

export default FileHandlerFeaturePreview;
