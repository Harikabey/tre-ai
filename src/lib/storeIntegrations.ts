import { getCachedAssetBlobUrl, getCachedPluginAsset } from './storePlugins';

const STOCKFISH_JS = 'https://unpkg.com/stockfish@19.0.1/bin/stockfish-19-lite-single.js';
const STOCKFISH_WASM = 'https://unpkg.com/stockfish@19.0.1/bin/stockfish-19-lite-single.wasm';
const GRAPHVIZ_WASM = 'https://cdn.jsdelivr.net/npm/graphviz-wasm@3.0.2/graphviz/graphviz.wasm';
const SQLITE_WASM = 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.54.1-build1/dist/sqlite3.wasm';
const Z3_WASM = 'https://cdn.jsdelivr.net/npm/z3-solver@5.3.3/build/z3-built.wasm';
const Z3_SCRIPT_URL = new URL(`${import.meta.env.BASE_URL}z3-built.js`, window.location.href).toString();

export const runPapaParseDemo = async (): Promise<string> => {
  const Papa = await import('papaparse');
  const result = Papa.parse<Record<string, string>>('ad,puan\nAda,98\nDeniz,91', { header: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }
  return JSON.stringify(result.data, null, 2);
};

export const startStockfish = async (onMessage: (message: string) => void): Promise<() => void> => {
  const engineResponse = await getCachedPluginAsset('stockfish', STOCKFISH_JS);
  const wasmResponse = await getCachedPluginAsset('stockfish', STOCKFISH_WASM);
  const engineUrl = URL.createObjectURL(await engineResponse.blob());
  const wasmUrl = URL.createObjectURL(await wasmResponse.blob());
  const workerSource = `
    self.Module = {
      locateFile: (path) => path.endsWith('.wasm') ? ${JSON.stringify(wasmUrl)} : path
    };
    importScripts(${JSON.stringify(engineUrl)});
  `;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));

  try {
    const worker = new Worker(workerUrl);
    worker.onmessage = (event: MessageEvent<string>) => onMessage(String(event.data));
    worker.onerror = (event) => {
      onMessage(`Stockfish Worker hatası: ${event.message}`);
    };
    worker.postMessage('uci');
    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      URL.revokeObjectURL(engineUrl);
      URL.revokeObjectURL(wasmUrl);
    };
  } catch (error) {
    URL.revokeObjectURL(workerUrl);
    URL.revokeObjectURL(engineUrl);
    URL.revokeObjectURL(wasmUrl);
    throw error;
  }
};

export const processJpegInWorker = async (file: File): Promise<Blob> => {
  const id = Date.now();
  const inputBuffer = await file.arrayBuffer();
  const worker = new Worker(new URL('../workers/imageProcessor.worker.ts', import.meta.url), { type: 'module' });

  return new Promise<Blob>((resolve, reject) => {
    const cleanUp = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<{ id: number; buffer?: ArrayBuffer; error?: string }>) => {
      if (event.data.id !== id) return;
      cleanUp();
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else if (event.data.buffer) {
        resolve(new Blob([event.data.buffer], { type: 'image/jpeg' }));
      } else {
        reject(new Error('Görsel işleyici boş yanıt verdi.'));
      }
    };
    worker.onerror = (event) => {
      cleanUp();
      reject(new Error(event.message || 'Görsel işleyici Worker başlatılamadı.'));
    };
    worker.postMessage({ id, buffer: inputBuffer }, [inputBuffer]);
  });
};

export const renderGraphvizSvg = async (dot: string): Promise<string> => {
  const wasmResponse = await getCachedPluginAsset('graphviz', GRAPHVIZ_WASM);
  const wasmUrl = URL.createObjectURL(await wasmResponse.blob());
  try {
    const { default: loadGraphviz } = await import('@graphviz-wasm-wrapper');
    const runtime = await loadGraphviz({ locateFile: () => wasmUrl });
    const graph = new runtime.Graphviz();
    try {
      return graph.layout(dot, 'svg', 'dot');
    } finally {
      runtime.destroy(graph);
    }
  } finally {
    URL.revokeObjectURL(wasmUrl);
  }
};

export const runSqliteDemo = async (): Promise<string> => {
  const cachedWasm = await getCachedPluginAsset('sqlite', SQLITE_WASM);
  if (!cachedWasm.ok || !cachedWasm.headers.get('Content-Type')?.toLowerCase().startsWith('application/wasm')) {
    throw new Error('SQLite WASM dosyasının MIME türü application/wasm değil.');
  }
  const { default: initializeSqlite } = await import('@sqlite.org/sqlite-wasm');
  const sqlite3 = await initializeSqlite();
  const db = new sqlite3.oo1.DB(':memory:', 'c');
  try {
    db.exec('CREATE TABLE store_demo (name TEXT, value INTEGER); INSERT INTO store_demo VALUES (\'Tre\', 6);');
    const rows: unknown[][] = [];
    db.exec({
      sql: 'SELECT name, value FROM store_demo',
      rowMode: 'array',
      callback: (row) => {
        rows.push(Array.isArray(row) ? row : [row]);
      },
    });
    return JSON.stringify(rows);
  } finally {
    db.close();
  }
};

let z3RuntimeScript: Promise<void> | null = null;

const ensureZ3RuntimeScript = (): Promise<void> => {
  if (!z3RuntimeScript) {
    z3RuntimeScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = Z3_SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => {
        z3RuntimeScript = null;
        reject(new Error('Z3 çalışma zamanı yüklenemedi.'));
      };
      document.head.appendChild(script);
    });
  }
  return z3RuntimeScript;
};

export const runZ3Demo = async (): Promise<string> => {
  if (typeof SharedArrayBuffer === 'undefined' || !window.crossOriginIsolated) {
    throw new Error('Z3 için SharedArrayBuffer gerekli. COOP/COEP başlıklarını destekleyen bir ortamda açın.');
  }
  const wasmUrl = await getCachedAssetBlobUrl('z3', Z3_WASM);
  try {
    await ensureZ3RuntimeScript();
    const { init } = await import('z3-solver');
    const api = await init({
      locateFile: (file) => file.endsWith('.wasm')
        ? wasmUrl
        : new URL(file, Z3_SCRIPT_URL).toString(),
    });
    const { Context } = api;
    const { Solver, Int } = new Context('tre-store');
    const x = Int.const('x');
    const solver = new Solver();
    solver.add(x.eq(3));
    return `x = 3 için: ${await solver.check()}`;
  } finally {
    URL.revokeObjectURL(wasmUrl);
  }
};
