import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Brush,
  Check,
  Cpu,
  Database,
  FileImage,
  Hammer,
  Loader2,
  Monitor,
  Music2,
  Package,
  Puzzle,
  ChevronRight,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ModuleCard from '@/components/ModuleCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type AgentModuleId = 'treos' | 'trejen' | 'simitci' | 'tre-nt' | 'treforge';
type StoreModuleId = AgentModuleId | PluginId;

const pluginGradients: Record<PluginId, string> = {
  stockfish: 'from-emerald-500/15 via-card to-cyan-500/10',
  papaparse: 'from-sky-500/15 via-card to-indigo-500/10',
  image: 'from-pink-500/15 via-card to-violet-500/10',
  graphviz: 'from-blue-500/15 via-card to-cyan-500/10',
  sqlite: 'from-amber-500/15 via-card to-orange-500/10',
  z3: 'from-violet-500/15 via-card to-fuchsia-500/10',
};

const categories = [
  { id: 'custom-tre', title: 'Özelleştirilmiş Tre', modules: ['treos', 'trejen', 'simitci', 'tre-nt', 'treforge'] },
  { id: 'extensions', title: 'Tre Eklentisi', modules: STORE_PLUGINS.map((plugin) => plugin.id) },
  { id: 'creativity', title: 'Yaratıcılık', modules: ['trejen', 'tre-nt', 'image'] },
  { id: 'data-analysis', title: 'Veri Analizi', modules: ['treforge', 'papaparse', 'graphviz'] },
  { id: 'advanced-tools', title: 'Gelişmiş Araçlar', modules: ['treos', 'z3', 'sqlite'] },
] satisfies { id: string; title: string; modules: StoreModuleId[] }[];

const featuredModuleIds = ['treos', 'trejen', 'tre-nt'];

interface AgentModule {
  id: AgentModuleId;
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  requirements: string[];
  activate: () => void;
  actionLabel: string;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Store = () => {
  const navigate = useNavigate();
  const capabilities = useSystemCapabilities();
  const [installed, setInstalled] = useState<PluginId[]>([]);
  const [busyPlugin, setBusyPlugin] = useState<PluginId | null>(null);
  const [output, setOutput] = useState<Partial<Record<PluginId, string>>>({});
  const [graphvizImage, setGraphvizImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [loadedPapaParse, setLoadedPapaParse] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'carousel'>(
    () => localStorage.getItem('tre-store-view') === 'list' ? 'list' : 'carousel',
  );
  const [consentOpen, setConsentOpen] = useState(false);
  const [treOsConsentGranted, setTreOsConsentGranted] = useState(
    () => localStorage.getItem('treos_consent_granted') === 'true',
  );
  const stockfishStop = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('tre-store-view', viewMode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Görünüm tercihi kaydedilemedi.');
    }
  }, [viewMode]);

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
      if (id === 'image') setSelectedImageFile(null);
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
        const file = selectedImageFile;
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
  const agentModules: AgentModule[] = [
    {
      id: 'treos',
      title: 'TreOS Beta',
      description: 'Güvenli MCP tüneli üzerinden bilgisayarınızda izin verilen işlemleri gerçekleştirin. Terminal erişimi devre dışıdır.',
      icon: <Monitor />,
      gradient: 'from-cyan-500/20 via-card to-blue-500/10',
      requirements: ['🌐 Yerel Ağ', '🖥️ MCP sunucusu'],
      activate: () => treOsConsentGranted ? navigate('/treos') : setConsentOpen(true),
      actionLabel: treOsConsentGranted ? 'TreOS’u aç' : 'Etkinleştir',
    },
    {
      id: 'trejen',
      title: 'Trejen',
      description: 'Yapay zeka destekli, tarayıcıda çalışan müzik prodüksiyon stüdyosu.',
      icon: <Music2 />,
      gradient: 'from-cyan-500/20 via-card to-teal-500/10',
      requirements: ['🎹 Müzik stüdyosu', '🌐 Tarayıcı'],
      activate: () => navigate('/trejen'),
      actionLabel: 'Etkinleştir',
    },
    {
      id: 'simitci',
      title: 'si-MİTÇİ - Sanal Gezgin',
      description: 'Yerel MCP sunucusu üzerinden herkese açık web sayfalarında salt-okunur araştırma yap.',
      icon: <Sparkles />,
      gradient: 'from-amber-500/20 via-card to-orange-500/10',
      requirements: ['🌐 Yerel Ağ', '🔎 Web araştırması'],
      activate: () => navigate('/simitci'),
      actionLabel: 'Etkinleştir',
    },
    {
      id: 'tre-nt',
      title: 'Tre-nt',
      description: 'Kendi Pet’ini çiz, canlandır ve el hareketlerinle AR atölyesinde şekillendir.',
      icon: <Brush />,
      gradient: 'from-fuchsia-500/20 via-card to-pink-500/10',
      requirements: ['📷 Kamera', '✋ El takibi'],
      activate: () => navigate('/tre-nt'),
      actionLabel: 'Etkinleştir',
    },
    {
      id: 'treforge',
      title: 'TreForge',
      description: 'Sıfırdan eğitilebilir yapay zeka. Ona bir link verin, kendini geliştirsin.',
      icon: <Hammer />,
      gradient: 'from-amber-500/20 via-card to-yellow-500/10',
      requirements: ['🔗 İnternet', '🧠 Yapay zeka'],
      activate: () => navigate('/treforge'),
      actionLabel: 'Etkinleştir',
    },
  ];
  const normalizedSearch = search.trim().toLocaleLowerCase('tr');
  const matchesSearch = (title: string, description: string) => (
    !normalizedSearch
    || title.toLocaleLowerCase('tr').includes(normalizedSearch)
    || description.toLocaleLowerCase('tr').includes(normalizedSearch)
  );
  const visibleAgentModules = agentModules.filter((module) => matchesSearch(module.title, module.description));
  const visiblePlugins = STORE_PLUGINS.filter((plugin) => matchesSearch(plugin.name, plugin.description));
  const visibleModuleIds = new Set([
    ...visibleAgentModules.map((module) => module.id),
    ...visiblePlugins.map((plugin) => plugin.id),
  ]);
  const visibleCategories = categories.filter((category) => category.modules.some((id) => visibleModuleIds.has(id)));
  const visibleFeaturedModules = agentModules.filter((module) => (
    featuredModuleIds.includes(module.id) && visibleModuleIds.has(module.id)
  ));

  const renderAgentCard = (moduleId: AgentModuleId, className = '') => {
    const module = agentModules.find((item) => item.id === moduleId);
    if (!module) return null;
    return (
      <ModuleCard
        key={module.id}
        title={module.title}
        description={module.description}
        icon={module.icon}
        gradient={module.gradient}
        requirements={module.requirements}
        className={className}
      >
        <Button className="shadow-[0_0_18px_hsl(var(--primary)/0.28)]" onClick={module.activate}>
          {module.actionLabel}
        </Button>
      </ModuleCard>
    );
  };

  const renderPluginCard = (pluginId: PluginId, className = '') => {
    const plugin = STORE_PLUGINS.find((item) => item.id === pluginId);
    if (!plugin) return null;
    const Icon = pluginIcons[plugin.id];
    const isInstalled = installed.includes(plugin.id);
    const compatibility = compatibilityReasons(plugin.id);
    const busy = busyPlugin === plugin.id;
    const requirements = plugin.id === 'image'
      ? ['🖼️ JPEG', '📷 Dosya']
      : plugin.id === 'papaparse'
        ? ['📄 CSV', '⚙️ Tarayıcı']
        : plugin.id === 'graphviz'
          ? ['📊 DOT', '⚙️ WASM']
          : plugin.id === 'sqlite'
            ? ['🗃️ SQL', '⚙️ WASM']
            : plugin.id === 'z3'
              ? ['🧩 SMT', '⚙️ WASM']
              : ['♟️ Satranç', '⚙️ WASM'];

    return (
      <ModuleCard
        key={plugin.id}
        title={plugin.name}
        description={plugin.description}
        icon={<Icon />}
        gradient={pluginGradients[plugin.id]}
        requirements={requirements}
        className={className}
      >
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
            <input
              type="file"
              accept="image/jpeg"
              className="mt-1 block w-full text-xs"
              onChange={(event) => setSelectedImageFile(event.currentTarget.files?.[0] ?? null)}
            />
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
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {plugin.id === 'papaparse' ? (
            <Button size="sm" onClick={() => void runPlugin(plugin.id)} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Package />}
              {loadedPapaParse ? 'Örneği yeniden çalıştır' : 'Dinamik yükle ve dene'}
            </Button>
          ) : isInstalled ? (
            <>
              <Button size="sm" onClick={() => void runPlugin(plugin.id)} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />}
                {plugin.id === 'stockfish' && stockfishStop.current ? 'Durdur' : 'Çalıştır'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void handleRemove(plugin.id)} disabled={busy}>
                <Trash2 /> Kaldır
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => void handleInstall(plugin.id)}
              disabled={busy || capabilities.checking || compatibility.length > 0}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Package />}
              İndir
            </Button>
          )}
          {isInstalled && <span className="self-center text-xs text-emerald-600 dark:text-emerald-400">Kurulu</span>}
        </div>
      </ModuleCard>
    );
  };

  const renderCatalogCard = (moduleId: StoreModuleId, className = '') => {
    if (
      moduleId === 'treos'
      || moduleId === 'trejen'
      || moduleId === 'simitci'
      || moduleId === 'tre-nt'
      || moduleId === 'treforge'
    ) {
      return renderAgentCard(moduleId, className);
    }
    return renderPluginCard(moduleId, className);
  };

  return (
    <main className="min-h-[100dvh] scroll-smooth bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
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

        <section aria-label="Mağazada ara ve görünümü seç" className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Modül veya eklenti ara"
              aria-label="Modül veya eklenti ara"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
            <span className="px-2 text-sm text-muted-foreground">Görünüm:</span>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              Liste
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'carousel' ? 'default' : 'ghost'}
              aria-pressed={viewMode === 'carousel'}
              onClick={() => setViewMode('carousel')}
            >
              Rulo
            </Button>
          </div>
        </section>

        {viewMode === 'carousel' && visibleCategories.length > 0 && (
          <nav aria-label="Kategorilere atla" className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => document.getElementById(category.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-sm hover:border-primary/50 hover:text-primary"
              >
                {category.title}<ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </nav>
        )}

        {visibleFeaturedModules.length > 0 && (
          <section aria-labelledby="featured-title" className="mb-8">
            <div className="mb-3">
              <h2 id="featured-title" className="text-xl font-semibold">Öne Çıkan Trelar</h2>
              <p className="text-sm text-muted-foreground">Tre’nin popüler stüdyolarını keşfet.</p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {visibleFeaturedModules.map((module) => (
                <div key={module.id} className="w-[85%] shrink-0 md:w-[calc((100%-2rem)/3)]">
                  {renderAgentCard(module.id, 'min-h-52 p-5')}
                </div>
              ))}
            </div>
          </section>
        )}

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

        {viewMode === 'list' ? (
          <div className="space-y-8">
            <section aria-labelledby="list-agents-title" className="space-y-4">
              <h2 id="list-agents-title" className="text-xl font-semibold">Tre Modülleri</h2>
              {visibleAgentModules.map((module) => renderAgentCard(module.id, 'w-full'))}
            </section>
            <section aria-labelledby="list-plugins-title">
              <h2 id="list-plugins-title" className="mb-4 text-xl font-semibold">Eklentiler</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visiblePlugins.map((plugin) => renderPluginCard(plugin.id))}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            {visibleCategories.map((category) => (
              <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} className="scroll-mt-6">
                <h2 id={`${category.id}-title`} className="mb-3 text-xl font-semibold">{category.title}</h2>
                <div className="flex gap-0 overflow-x-auto pb-3">
                  {category.modules
                    .filter((moduleId) => visibleModuleIds.has(moduleId))
                    .map((moduleId) => renderCatalogCard(moduleId, 'w-[33.33%] shrink-0 md:w-[16.66%]'))}
                </div>
              </section>
            ))}
          </div>
        )}
        {visibleModuleIds.size === 0 && (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            Aramanızla eşleşen modül bulunamadı.
          </p>
        )}

        <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>TreOS Beta yetki onayı</DialogTitle>
              <DialogDescription>
                TreOS’un bilgisayarınızla (fare, dosya yönetimi) haberleşmesine izin vermek üzeresiniz.
                Terminal yetkisi devre dışıdır. Bilgisayarınızda MCP sunucusunu başlatıp URL’ini girmeniz gerekecektir.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConsentOpen(false)}>Vazgeç</Button>
              <Button onClick={() => {
                localStorage.setItem('treos_consent_granted', 'true');
                setTreOsConsentGranted(true);
                setConsentOpen(false);
                navigate('/treos');
              }}>
                Onayla ve devam et
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
};

export default Store;
