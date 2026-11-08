import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Cpu,
  Database,
  FileImage,
  Loader2,
  Package,
  Puzzle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSystemCapabilities } from '@/hooks/useSystemCapabilities';
import {
  installPlugin,
  removePlugin,
  STORE_PLUGINS,
  verifyInstalledPlugins,
  type PluginId,
} from '@/lib/storePlugins';
import {
  processJpegInWorker,
  renderGraphvizSvg,
  runPapaParseDemo,
  runSqliteDemo,
  runZ3Demo,
  startStockfish,
} from '@/lib/storeIntegrations';

const pluginIcons = {
  stockfish: Cpu,
  papaparse: FileImage,
  image: FileImage,
  graphviz: Puzzle,
  sqlite: Database,
  z3: Cpu,
} satisfies Record<PluginId, typeof Cpu>;

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Store = () => {
  const capabilities = useSystemCapabilities();
  const [installed, setInstalled] = useState<PluginId[]>([]);
  const [busyPlugin, setBusyPlugin] = useState<PluginId | null>(null);
  const [output, setOutput] = useState<Partial<Record<PluginId, string>>>({});
  const [graphvizImage, setGraphvizImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [loadedPapaParse, setLoadedPapaParse] = useState(false);
  const stockfishStop = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    void verifyInstalledPlugins()
      .then((ids) => { if (active) setInstalled(ids); })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Kurulu eklentiler doğrulanamadı.');
      });
    return () => {
      active = false;
      stockfishStop.current?.();
    };
  }, []);

  useEffect(() => () => {
    if (graphvizImage) URL.revokeObjectURL(graphvizImage);
  }, [graphvizImage]);

  useEffect(() => () => {
    if (processedImage) URL.revokeObjectURL(processedImage);
  }, [processedImage]);

  const compatibilityReasons = useCallback((id: PluginId): string[] => {
    const plugin = STORE_PLUGINS.find((item) => item.id === id);
    if (!plugin || id === 'papaparse') return [];
    const reasons: string[] = [];
    if (plugin.wasm && !capabilities.wasm) reasons.push('Tarayıcı WebAssembly’i desteklemiyor.');
    if (!capabilities.cacheApi) reasons.push('Kalıcı önbellek için Cache API desteklenmiyor.');
    if (!capabilities.storageApi || capabilities.storageFreeBytes === null) {
      reasons.push('Depolama alanı ölçülemedi; indirme güvenli biçimde başlatılamıyor.');
    } else if (capabilities.storageFreeBytes < plugin.sizeBytes) {
      reasons.push(`Yetersiz depolama alanı: ${formatSize(plugin.sizeBytes)} gerekiyor.`);
    }
    if (capabilities.memoryGb !== null && capabilities.memoryGb < plugin.minMemoryGb) {
      reasons.push(`Bu eklenti için en az ${plugin.minMemoryGb} GB bellek gerekiyor.`);
    }
    if (id === 'z3' && (typeof SharedArrayBuffer === 'undefined' || !window.crossOriginIsolated)) {
      reasons.push('Z3 için SharedArrayBuffer ve COOP/COEP başlıkları gerekiyor.');
    }
    return reasons;
  }, [capabilities]);

  const handleInstall = async (id: PluginId) => {
    const reasons = compatibilityReasons(id);
    if (reasons.length > 0) return;
    setBusyPlugin(id);
    try {
      await installPlugin(id);
      setInstalled(await verifyInstalledPlugins());
      toast.success(`${STORE_PLUGINS.find((plugin) => plugin.id === id)?.name} kuruldu.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eklenti indirilemedi.');
    } finally {
      setBusyPlugin(null);
    }
  };

  const handleRemove = async (id: PluginId) => {
    setBusyPlugin(id);
    try {
      await removePlugin(id);
      setInstalled(await verifyInstalledPlugins());
      setOutput((current) => ({ ...current, [id]: undefined }));
      if (id === 'stockfish') {
        stockfishStop.current?.();
        stockfishStop.current = null;
      }
      toast.success(`${STORE_PLUGINS.find((plugin) => plugin.id === id)?.name} kaldırıldı.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eklenti kaldırılamadı.');
    } finally {
      setBusyPlugin(null);
    }
  };

  const runPlugin = async (id: PluginId) => {
    setBusyPlugin(id);
    try {
      if (id === 'papaparse') {
        const result = await runPapaParseDemo();
        setOutput((current) => ({ ...current, [id]: result }));
        setLoadedPapaParse(true);
      } else if (id === 'stockfish') {
        if (stockfishStop.current) {
          stockfishStop.current();
          stockfishStop.current = null;
          setOutput((current) => ({ ...current, [id]: 'Stockfish durduruldu.' }));
        } else {
          setOutput((current) => ({ ...current, [id]: 'Stockfish başlatılıyor…' }));
          stockfishStop.current = await startStockfish((message) => {
            setOutput((current) => ({ ...current, stockfish: message }));
          });
        }
      } else if (id === 'image') {
        const input = document.getElementById('store-image-input') as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) throw new Error('Önce bir JPEG görseli seçin.');
        const result = await processJpegInWorker(file);
        const resultUrl = URL.createObjectURL(result);
        setProcessedImage((current) => {
          if (current) URL.revokeObjectURL(current);
          return resultUrl;
        });
        setOutput((current) => ({
          ...current,
          [id]: `${file.name} işlendi · çıktı ${formatSize(result.size)}`,
        }));
      } else if (id === 'graphviz') {
        const svg = await renderGraphvizSvg('digraph Tre { Store -> Plugins; Plugins -> WASM; }');
        const nextImageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        setGraphvizImage((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextImageUrl;
        });
        setOutput((current) => ({ ...current, [id]: 'DOT tanımı güvenli SVG görseline dönüştürüldü.' }));
      } else if (id === 'sqlite') {
        const result = await runSqliteDemo();
        setOutput((current) => ({ ...current, [id]: result }));
      } else if (id === 'z3') {
        const result = await runZ3Demo();
        setOutput((current) => ({ ...current, [id]: result }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eklenti çalıştırılamadı.');
      setOutput((current) => ({ ...current, [id]: 'Çalıştırma başarısız oldu.' }));
    } finally {
      setBusyPlugin(null);
    }
  };

  const storageText = capabilities.storageFreeBytes === null
    ? 'Kullanılamıyor'
    : `${formatSize(capabilities.storageFreeBytes)} boş`;
  const memoryText = capabilities.memoryGb === null ? 'Bilinmiyor' : `${capabilities.memoryGb} GB`;

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center gap-3">
          <Link to="/" aria-label="Sohbete dön" className="rounded-full border border-border p-2 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Tre Mağazası</h1>
            <p className="text-sm text-muted-foreground">Tarayıcıda çalışan eklentileri yükle ve yönet.</p>
          </div>
        </header>

        <section aria-label="Sistem kontrolü" className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Package className="h-4 w-4 text-primary" />
            Sistem kontrolü
            {capabilities.checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>WASM: <span className={capabilities.wasm ? 'text-emerald-500' : 'text-destructive'}>{capabilities.wasm ? 'Destekleniyor' : 'Desteklenmiyor'}</span></p>
            <p>Depolama: <span>{storageText}</span></p>
            <p>Bellek: <span>{memoryText}</span></p>
          </div>
          {capabilities.error && <p className="mt-2 text-sm text-destructive">{capabilities.error}</p>}
          {capabilities.memoryGb === null && (
            <p className="mt-2 text-xs text-muted-foreground">Tarayıcı bellek bilgisini vermediğinden bellek uyumluluğu doğrulanamıyor.</p>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STORE_PLUGINS.map((plugin) => {
            const Icon = pluginIcons[plugin.id];
            const isInstalled = installed.includes(plugin.id);
            const compatibility = compatibilityReasons(plugin.id);
            const busy = busyPlugin === plugin.id;
            return (
              <article key={plugin.id} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{plugin.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{plugin.description}</p>
                  </div>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">Boyut: {plugin.sizeLabel}</p>
                {plugin.note && <p className="mb-3 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">{plugin.note}</p>}
                {compatibility.length > 0 && (
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-destructive">
                    {compatibility.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                )}
                {plugin.id === 'image' && isInstalled && (
                  <label className="mb-3 block text-xs text-muted-foreground">
                    JPEG görsel seç
                    <input id="store-image-input" type="file" accept="image/jpeg" className="mt-1 block w-full text-xs" />
                  </label>
                )}
                {output[plugin.id] && (
                  <pre className="mb-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{output[plugin.id]}</pre>
                )}
                {plugin.id === 'graphviz' && graphvizImage && (
                  <img src={graphvizImage} alt="Graphviz DOT diyagramı" className="mb-3 max-h-44 max-w-full rounded border border-border bg-white p-2" />
                )}
                {plugin.id === 'image' && processedImage && (
                  <a href={processedImage} download="tre-image.jpg" className="mb-3 inline-flex w-fit">
                    <img src={processedImage} alt="İşlenmiş JPEG görseli" className="max-h-44 max-w-full rounded border border-border" />
                  </a>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {plugin.id === 'papaparse' ? (
                    <Button size="sm" onClick={() => void runPlugin(plugin.id)} disabled={busy}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                      {loadedPapaParse ? 'Örneği yeniden çalıştır' : 'Dinamik yükle ve dene'}
                    </Button>
                  ) : isInstalled ? (
                    <>
                      <Button size="sm" onClick={() => void runPlugin(plugin.id)} disabled={busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        {plugin.id === 'stockfish' && stockfishStop.current ? 'Durdur' : 'Çalıştır'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void handleRemove(plugin.id)} disabled={busy}>
                        <Trash2 className="mr-2 h-4 w-4" /> Kaldır
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => void handleInstall(plugin.id)} disabled={busy || capabilities.checking || compatibility.length > 0}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                      İndir
                    </Button>
                  )}
                  {isInstalled && <span className="self-center text-xs text-emerald-600 dark:text-emerald-400">Kurulu</span>}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
};

export default Store;
