import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  ExternalLink,
  FileArchive,
  Terminal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const TERMINAL_ZIP_URL = `${import.meta.env.BASE_URL}treos-terminal.zip`;

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-xl border border-emerald-500/15 bg-black/50 px-4 py-3 font-mono text-sm leading-6 text-emerald-200">
    <code>{children}</code>
  </pre>
);

const GuideStep = ({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="grid gap-4 border-t border-emerald-500/10 py-6 sm:grid-cols-[3rem_1fr]">
    <span className="font-mono text-sm text-emerald-500">{number.padStart(2, '0')}</span>
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-emerald-50">{title}</h3>
      {children}
    </div>
  </section>
);

const TreOS = () => (
  <main className="min-h-screen overflow-hidden bg-[#030906] font-mono text-emerald-50 selection:bg-emerald-400/30">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_55%)]" />
    <div className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      <header className="flex items-center justify-between border-b border-emerald-500/10 py-5">
        <Link
          to="/store"
          className="inline-flex items-center gap-2 text-sm text-emerald-100/70 transition hover:text-emerald-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          TreOS
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          TREOS TERMINAL
        </span>
      </header>

      <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-emerald-500">
            <Terminal className="h-4 w-4" aria-hidden="true" />
            Bilgisayarınız, doğal dilinizle
          </div>
          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
              TreOS Terminal Aracı
            </h1>
            <p className="max-w-2xl font-sans text-base leading-7 text-emerald-50/65 sm:text-lg">
              TreOS Terminal, yapay zeka destekli bir komut satırı asistanıdır.
              Bilgisayarınıza indirin, API anahtarınızı girin ve doğal dilde komut
              vererek bilgisayarınızı yönetin.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-emerald-100/60">
            {['Python 3.10+', 'Windows · macOS · Linux', 'Groq · OpenRouter'].map((item) => (
              <span key={item} className="rounded-full border border-emerald-500/15 px-3 py-1.5">
                {item}
              </span>
            ))}
          </div>
          <a href="#download" className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200">
            Kuruluma geç
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-[#06100a]/90 p-1 shadow-[0_20px_100px_rgba(16,185,129,0.08)]">
          <div className="flex items-center gap-2 border-b border-emerald-500/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-2 text-xs text-emerald-100/40">treos-terminal</span>
          </div>
          <div className="space-y-5 p-5 sm:p-7">
            <p className="text-xs text-emerald-500">› İsteğinizi yazın</p>
            <p className="text-sm leading-6 text-emerald-50">
              &gt; Belgeler klasöründe yapılacaklar.txt dosyası oluştur
            </p>
            <div className="rounded-xl border border-emerald-500/10 bg-black/35 p-4">
              <p className="mb-3 text-[11px] uppercase tracking-wider text-emerald-500">
                YAPILACAKLAR
              </p>
              <p className="text-xs leading-6 text-emerald-100/75">
                1. Dosya yaz: Belgeler/yapılacaklar.txt
                <br />
                <span className="text-emerald-100/40">Sebep: İstenen listeyi oluştur</span>
              </p>
            </div>
            <div className="flex items-center gap-2 border-t border-emerald-500/10 pt-4 text-xs text-emerald-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/10">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              İşlem, siz onayladıktan sonra başlar.
              <span className="ml-auto animate-pulse text-emerald-400">_</span>
            </div>
          </div>
        </div>
      </section>

      <section id="download" className="scroll-mt-8 space-y-6 py-10">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Başlangıç</p>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">İki şekilde kullanın</h2>
          <p className="font-sans text-sm leading-6 text-emerald-50/55">
            İhtiyacınıza uygun yöntemi seçin. Kaynak kodunu indirip Python ile hemen çalıştırabilir
            veya kendi Windows EXE dosyanızı oluşturabilirsiniz.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] uppercase tracking-wider text-emerald-300">
                Önerilen
              </span>
              <FileArchive className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold text-white">Python ile Çalıştır</h3>
            <p className="mt-3 flex-1 font-sans text-sm leading-6 text-emerald-50/60">
              Kaynak kodu ZIP dosyası olarak indirin. Python 3.10 veya üzeriyle Windows,
              macOS ya da Linux üzerinde çalıştırabilirsiniz.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="bg-emerald-400 font-mono text-[#031008] hover:bg-emerald-300">
                <a href={TERMINAL_ZIP_URL} download="treos-terminal.zip">
                  <ArrowDownToLine className="mr-2 h-4 w-4" aria-hidden="true" />
                  Python ile Çalıştır
                </a>
              </Button>
              <Button asChild variant="outline" className="border-emerald-500/25 font-mono text-emerald-200 hover:bg-emerald-400/10">
                <a href={TERMINAL_ZIP_URL} download="treos-terminal.zip">
                  Kodu İndir
                </a>
              </Button>
            </div>
            <p className="mt-3 text-xs text-emerald-100/40">treos-terminal.zip · API anahtarınız yerel kalır</p>
          </article>

          <article className="flex flex-col rounded-2xl border border-emerald-500/15 bg-[#06100a] p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-full border border-emerald-500/20 px-3 py-1 text-[11px] uppercase tracking-wider text-emerald-100/55">
                Gelişmiş
              </span>
              <Code2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold text-white">Kendi EXE'nizi Derleyin</h3>
            <p className="mt-3 font-sans text-sm leading-6 text-emerald-50/60">
              ZIP içindeki kaynak koduyla kendi Windows çalıştırılabilir dosyanızı oluşturun.
              Ayrıntılı adımlar aşağıdaki rehberde.
            </p>
            <div className="mt-6 space-y-3">
              <CodeBlock>pip install pyinstaller</CodeBlock>
              <CodeBlock>pyinstaller --onefile --name treos-terminal main.py</CodeBlock>
            </div>
            <a href="#guide" className="mt-5 inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200">
              Derleme rehberine git
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </article>
        </div>
      </section>

      <section id="guide" className="scroll-mt-8 py-16">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-emerald-300">
            <Terminal className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Adım adım</p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Kurulum ve EXE Derleme Rehberi
            </h2>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-[#06100a]/80 px-5 sm:px-8">
          <GuideStep number="1" title="Python'u İndirin ve Kurun">
            <ul className="list-disc space-y-2 pl-5 font-sans text-sm leading-6 text-emerald-50/65 marker:text-emerald-500">
              <li>
                <a
                  href="https://www.python.org/downloads/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 underline decoration-emerald-500/40 underline-offset-4 hover:text-emerald-200"
                >
                  python.org
                </a>
                {' '}adresinden Python 3.10 veya üzeri bir sürümü indirin.
              </li>
              <li>Kurulum sırasında "Add Python to PATH" seçeneğini mutlaka işaretleyin.</li>
            </ul>
          </GuideStep>

          <GuideStep number="2" title="TreOS Terminal Kodunu İndirin">
            <ul className="list-disc space-y-2 pl-5 font-sans text-sm leading-6 text-emerald-50/65 marker:text-emerald-500">
              <li>
                Sayfanın üstündeki{' '}
                <a href="#download" className="text-emerald-300 underline underline-offset-4">
                  Kodu İndir
                </a>
                {' '}butonuna tıklayarak <code className="text-emerald-200">treos-terminal.zip</code> dosyasını indirin.
              </li>
              <li>İndirdiğiniz ZIP dosyasını bir klasöre çıkartın.</li>
            </ul>
          </GuideStep>

          <GuideStep number="3" title="Terminali Açın ve Kütüphaneleri Kurun">
            <p className="font-sans text-sm leading-6 text-emerald-50/65">
              Çıkarttığınız klasörde terminali (CMD veya PowerShell) açın ve şu komutu çalıştırın:
            </p>
            <CodeBlock>pip install -r requirements.txt</CodeBlock>
          </GuideStep>

          <GuideStep number="4" title="Programı Çalıştırın (Python ile)">
            <p className="font-sans text-sm leading-6 text-emerald-50/65">
              Aynı terminalde uygulamayı başlatın:
            </p>
            <CodeBlock>python main.py</CodeBlock>
          </GuideStep>

          <GuideStep number="5" title="Kendi EXE Dosyanızı Derleyin (İsteğe Bağlı)">
            <p className="font-sans text-sm leading-6 text-emerald-50/65">
              Programı Windows'ta <code className="text-emerald-200">.exe</code> olarak kullanmak isterseniz,
              önce PyInstaller'ı kurup derleme komutunu çalıştırın:
            </p>
            <div className="space-y-3">
              <CodeBlock>pip install pyinstaller</CodeBlock>
              <CodeBlock>pyinstaller --onefile --name treos-terminal main.py</CodeBlock>
            </div>
            <p className="font-sans text-sm leading-6 text-emerald-50/65">
              Derleme bitince <code className="text-emerald-200">dist</code> klasöründe{' '}
              <code className="text-emerald-200">treos-terminal.exe</code> dosyanız hazır olacaktır.
            </p>
          </GuideStep>
        </div>
      </section>

      <footer className="flex flex-col gap-4 border-t border-emerald-500/10 pt-6 text-xs text-emerald-100/40 sm:flex-row sm:items-center sm:justify-between">
        <p>TreOS Terminal · API anahtarınızı yalnızca güvendiğiniz sağlayıcıda kullanın.</p>
        <Link to="/store" className="inline-flex items-center gap-2 transition hover:text-emerald-300">
          TreOS Mağazası
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  </main>
);

export default TreOS;
