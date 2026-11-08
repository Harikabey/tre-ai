export type PluginId = 'stockfish' | 'papaparse' | 'image' | 'graphviz' | 'sqlite' | 'z3';

export interface PluginAsset {
  url: string;
  contentType: string;
}

export interface StorePlugin {
  id: PluginId;
  name: string;
  description: string;
  sizeBytes: number;
  sizeLabel: string;
  minMemoryGb: number;
  wasm: boolean;
  assets: PluginAsset[];
  note?: string;
}

export const INSTALLED_PLUGINS_KEY = 'tre-installed-plugins';
export const PLUGIN_CACHE_NAME = 'tre-plugin-assets-v1';

const STOCKFISH_BASE = 'https://unpkg.com/stockfish@19.0.1/bin';
const IMAGE_BASE = 'https://cdn.jsdelivr.net/npm/@jsquash/jpeg@1.6.0';
const GRAPHVIZ_URL = 'https://cdn.jsdelivr.net/npm/graphviz-wasm@3.0.2/graphviz/graphviz.wasm';
const SQLITE_URL = 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.54.1-build1/dist/sqlite3.wasm';
const Z3_BASE = 'https://cdn.jsdelivr.net/npm/z3-solver@5.3.3/build';

export const STORE_PLUGINS: StorePlugin[] = [
  {
    id: 'stockfish',
    name: 'Stockfish',
    description: 'Tek iş parçacıklı, hafif Stockfish satranç motoru.',
    sizeBytes: 1_900_000,
    sizeLabel: '≈ 1,8 MB · lite / tek iş parçacıklı',
    minMemoryGb: 1,
    wasm: true,
    assets: [
      { url: `${STOCKFISH_BASE}/stockfish-19-lite-single.js`, contentType: 'javascript' },
      { url: `${STOCKFISH_BASE}/stockfish-19-lite-single.wasm`, contentType: 'application/wasm' },
    ],
  },
  {
    id: 'papaparse',
    name: 'PapaParse',
    description: 'CSV ve metin tablolarını tarayıcıda ayrıştırır.',
    sizeBytes: 0,
    sizeLabel: 'İstek üzerine yüklenir',
    minMemoryGb: 0,
    wasm: false,
    assets: [],
  },
  {
    id: 'image',
    name: 'Resim İşleyici',
    description: 'JPEG görsellerini Web Worker ve WASM ile kodlar/çözer.',
    sizeBytes: 450_000,
    sizeLabel: '≈ 450 KB',
    minMemoryGb: 2,
    wasm: true,
    assets: [
      { url: `${IMAGE_BASE}/codec/dec/mozjpeg_dec.wasm`, contentType: 'application/wasm' },
      { url: `${IMAGE_BASE}/codec/enc/mozjpeg_enc.wasm`, contentType: 'application/wasm' },
    ],
  },
  {
    id: 'graphviz',
    name: 'Graphviz',
    description: 'DOT tanımlarını WASM tabanlı Graphviz ile SVG’ye dönüştürür.',
    sizeBytes: 930_000,
    sizeLabel: '≈ 930 KB',
    minMemoryGb: 2,
    wasm: true,
    assets: [
      { url: GRAPHVIZ_URL, contentType: 'application/wasm' },
    ],
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Tarayıcı içinde SQL sorguları için geçici veritabanı.',
    sizeBytes: 880_000,
    sizeLabel: '≈ 880 KB',
    minMemoryGb: 1,
    wasm: true,
    assets: [
      { url: SQLITE_URL, contentType: 'application/wasm' },
    ],
    note: 'SQLite geçici modda çalışır; veriler sayfa yenilenince silinir.',
  },
  {
    id: 'z3',
    name: 'Z3 SMT Solver',
    description: 'Z3 paketinin kendi thread/worker mimarisiyle kısıt çözücü.',
    sizeBytes: 39_000_000,
    sizeLabel: '≈ 18 MB indirme',
    minMemoryGb: 4,
    wasm: true,
    assets: [
      { url: `${Z3_BASE}/z3-built.js`, contentType: 'javascript' },
      { url: `${Z3_BASE}/z3-built.wasm`, contentType: 'application/wasm' },
    ],
  },
];

export type InstalledPluginIds = PluginId[];

const getPlugin = (id: PluginId) => STORE_PLUGINS.find((plugin) => plugin.id === id)!;

const getCache = async () => {
  if (typeof caches === 'undefined') {
    throw new Error('Bu tarayıcı Cache API’yi desteklemiyor.');
  }
  return caches.open(PLUGIN_CACHE_NAME);
};

const readInstalledIds = (): InstalledPluginIds => {
  const raw = localStorage.getItem(INSTALLED_PLUGINS_KEY);
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((id) => !STORE_PLUGINS.some((plugin) => plugin.id === id))) {
    throw new Error('Kurulu eklenti listesi bozuk. Tarayıcı depolama verisini kontrol edin.');
  }
  return parsed as PluginId[];
};

const writeInstalledIds = (ids: InstalledPluginIds) => {
  localStorage.setItem(INSTALLED_PLUGINS_KEY, JSON.stringify([...new Set(ids)]));
};

export const verifyInstalledPlugins = async (): Promise<InstalledPluginIds> => {
  const savedIds = readInstalledIds().filter((id) => id !== 'papaparse');
  if (savedIds.length === 0) return [];

  const cache = await getCache();
  const verified: InstalledPluginIds = [];
  for (const id of savedIds) {
    const plugin = getPlugin(id);
    const responses = await Promise.all(plugin.assets.map((asset) => cache.match(asset.url)));
    const valid = responses.every((response, index) => {
      if (!response?.ok) return false;
      const asset = plugin.assets[index];
      return asset.contentType !== 'application/wasm'
        || response.headers.get('Content-Type')?.toLowerCase().startsWith('application/wasm') === true;
    });
    if (valid) {
      verified.push(id);
    } else {
      await Promise.all(plugin.assets.map((asset) => cache.delete(asset.url)));
    }
  }
  writeInstalledIds(verified);
  return verified;
};

export const installPlugin = async (id: PluginId): Promise<void> => {
  if (id === 'papaparse') {
    throw new Error('PapaParse doğrudan import edilir; indirme işlemi gerekmez.');
  }
  const plugin = getPlugin(id);
  const cache = await getCache();
  const storedUrls: string[] = [];

  try {
    for (const asset of plugin.assets) {
      const response = await fetch(asset.url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok || response.type === 'opaque') {
        throw new Error(`${plugin.name} dosyası indirilemedi (HTTP ${response.status}).`);
      }
      const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
      if (asset.contentType === 'application/wasm' && !contentType.startsWith('application/wasm')) {
        throw new Error(`${plugin.name} WASM dosyasının MIME türü application/wasm değil (${contentType || 'bilinmiyor'}).`);
      }
      await cache.put(asset.url, response.clone());
      storedUrls.push(asset.url);
    }

    writeInstalledIds([...readInstalledIds(), id]);
  } catch (error) {
    await Promise.all(storedUrls.map((url) => cache.delete(url)));
    throw error;
  }
};

export const removePlugin = async (id: PluginId): Promise<void> => {
  const cache = await getCache();
  const plugin = getPlugin(id);
  await Promise.all(plugin.assets.map((asset) => cache.delete(asset.url)));
  writeInstalledIds(readInstalledIds().filter((installedId) => installedId !== id));
};

export const getCachedPluginAsset = async (id: PluginId, url: string): Promise<Response> => {
  const plugin = getPlugin(id);
  if (!plugin.assets.some((asset) => asset.url === url)) {
    throw new Error(`${plugin.name} için istenen dosya tanımlı değil.`);
  }
  const cache = await getCache();
  const response = await cache.match(url);
  if (!response) {
    throw new Error(`${plugin.name} dosyası Cache API’de bulunamadı. Eklentiyi yeniden indir.`);
  }
  return response;
};

export const getCachedAssetBlobUrl = async (id: PluginId, url: string): Promise<string> => {
  const response = await getCachedPluginAsset(id, url);
  return URL.createObjectURL(await response.blob());
};
