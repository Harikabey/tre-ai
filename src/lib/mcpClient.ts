export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: { code?: number; message?: string };
}

const ALLOWED_TOOLS = new Set(['click_mouse', 'open_app', 'write_file']);
const BLOCKED_TOOL_NAME = /(shell|terminal|command|exec|powershell|bash|process|script)/i;
const MCP_PROTOCOL_VERSION = '2024-11-05';
const MAX_RESPONSE_SIZE = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export function validateMcpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Geçerli bir tünel URL’si girin.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Güvenlik için MCP tünel URL’si HTTPS kullanmalıdır.');
  }
  if (url.username || url.password || url.hash) {
    throw new Error('URL kullanıcı bilgisi veya fragment içeremez.');
  }
  return url;
}

export function filterMcpTools(value: unknown): McpTool[] {
  if (!Array.isArray(value)) throw new Error('MCP sunucusu geçerli bir araç listesi döndürmedi.');

  return value.filter((tool): tool is McpTool => {
    if (typeof tool !== 'object' || tool === null || Array.isArray(tool)) return false;
    const candidate = tool as Record<string, unknown>;
    if (
      typeof candidate.name !== 'string' ||
      !ALLOWED_TOOLS.has(candidate.name) ||
      BLOCKED_TOOL_NAME.test(candidate.name) ||
      typeof candidate.inputSchema !== 'object' ||
      candidate.inputSchema === null ||
      Array.isArray(candidate.inputSchema)
    ) return false;

    return JSON.stringify(candidate.inputSchema).length <= 10_000;
  });
}

export class McpClient {
  private endpoint: URL;
  private sessionId: string | null = null;
  private requestId = 0;
  private protocolVersion: string | null = null;

  private constructor(endpoint: URL) {
    this.endpoint = endpoint;
  }

  static async connect(value: string): Promise<{ client: McpClient; tools: McpTool[] }> {
    const client = new McpClient(validateMcpUrl(value));
    const initialized = await client.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'TreOS', version: '1.0.0' },
    });

    if (!isRecord(initialized) || initialized.protocolVersion !== MCP_PROTOCOL_VERSION) {
      throw new Error('MCP sunucusundan geçerli başlatma yanıtı alınamadı.');
    }
    client.protocolVersion = MCP_PROTOCOL_VERSION;
    await client.notify('notifications/initialized');

    const result = await client.request('tools/list', {});
    if (!isRecord(result)) throw new Error('MCP araç listesi okunamadı.');
    const tools = filterMcpTools(result.tools);
    return { client, tools };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const allowed = filterMcpTools([{ name, inputSchema: {} }]);
    if (!allowed.length) throw new Error(`Güvenlik nedeniyle "${name}" aracı engellendi.`);
    validateToolArguments(name, args);

    const result = await this.request('tools/call', { name, arguments: args });
    if (!isRecord(result)) throw new Error('MCP aracı geçerli bir yanıt döndürmedi.');
    if (result.isError === true) {
      throw new Error(extractToolText(result.content) || 'MCP aracı hata bildirdi.');
    }
    return extractToolText(result.content) || 'Adım tamamlandı.';
  }

  close(): void {
    this.sessionId = null;
  }

  private async notify(method: string): Promise<void> {
    await this.send({ jsonrpc: '2.0', method, params: {} }, false);
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const response = await this.send({
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    }, true);

    if (!isRecord(response)) throw new Error('MCP yanıtı geçersiz.');
    const rpcResponse = response as JsonRpcResponse;
    if (rpcResponse.error) {
      throw new Error(`MCP: ${rpcResponse.error.message || 'Bilinmeyen sunucu hatası'}`);
    }
    if (!('result' in rpcResponse)) throw new Error('MCP yanıtında sonuç bulunamadı.');
    return rpcResponse.result;
  }

  private async send(payload: Record<string, unknown>, expectsResponse: boolean): Promise<unknown> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
          ...(this.protocolVersion ? { 'MCP-Protocol-Version': this.protocolVersion } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok && response.status !== 202) {
        throw new Error(`MCP bağlantısı başarısız oldu (HTTP ${response.status}).`);
      }

      const sessionId = response.headers.get('Mcp-Session-Id');
      if (sessionId) this.sessionId = sessionId;
      if (!expectsResponse || response.status === 202 || response.status === 204) return null;

      const contentLength = Number(response.headers.get('Content-Length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_SIZE) {
        throw new Error('MCP yanıtı izin verilen boyutu aşıyor.');
      }
      const body = await readLimitedBody(response);
      return parseMcpResponse(body, response.headers.get('Content-Type'));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('MCP sunucusu 30 saniye içinde yanıt vermedi.');
      }
      if (error instanceof TypeError) {
        throw new Error('MCP tüneline erişilemedi. URL’yi ve tünel sunucusundaki CORS ayarlarını kontrol edin.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) throw new Error('MCP yanıt gövdesi bulunamadı.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_SIZE) {
      await reader.cancel();
      throw new Error('MCP yanıtı izin verilen boyutu aşıyor.');
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function parseMcpResponse(body: string, contentType: string | null): unknown {
  if (!body.trim()) throw new Error('MCP sunucusu boş yanıt döndürdü.');
  if (contentType?.includes('text/event-stream')) {
    const eventData = body
      .split(/\r?\n\r?\n/)
      .flatMap((event) => event.split(/\r?\n/))
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    for (const data of eventData) {
      if (data === '[DONE]') continue;
      try {
        const parsed: unknown = JSON.parse(data);
        if (isRecord(parsed) && ('result' in parsed || 'error' in parsed)) return parsed;
      } catch {
        continue;
      }
    }
    throw new Error('MCP olay akışında geçerli bir yanıt bulunamadı.');
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error('MCP sunucusu geçerli JSON döndürmedi.');
  }
}

function validateToolArguments(name: string, args: Record<string, unknown>): void {
  if (!isRecord(args)) throw new Error('Araç argümanları geçersiz.');
  if (JSON.stringify(args).length > 100_000) {
    throw new Error('Araç argümanları izin verilen boyutu aşıyor.');
  }
  if (name === 'open_app') {
    const appNames = Object.values(args).filter((value): value is string => typeof value === 'string');
    if (appNames.some((app) => /(terminal|powershell|command prompt|(^|[/\\])(cmd|bash|sh|zsh|fish|xterm|iterm|konsole|alacritty|wezterm|kitty)(\.exe)?$)/i.test(app))) {
      throw new Error('Güvenlik nedeniyle terminal uygulamalarının açılması engellendi.');
    }
  }
  if (name === 'write_file') {
    const pathEntry = Object.entries(args).find(([key]) => /^(path|file_?path)$/i.test(key));
    if (!pathEntry || typeof pathEntry[1] !== 'string') {
      throw new Error('Dosya yazma aracı güvenli bir göreli dosya yolu belirtmelidir.');
    }
    let path = pathEntry[1].replace(/\\/g, '/');
    try {
      for (let pass = 0; pass < 2; pass += 1) path = decodeURIComponent(path);
    } catch {
      throw new Error('Dosya yolu geçersiz biçimde kodlanmış.');
    }
    if (path.startsWith('/') || /^[a-z]:/i.test(path) || path.split('/').includes('..')) {
      throw new Error('Dosya yazma aracıyla mutlak yollar veya üst dizinlere erişim yapılamaz.');
    }
    const content = Object.entries(args).find(([key]) => /^(content|text)$/i.test(key))?.[1];
    if (typeof content !== 'string' || content.length > 100_000) {
      throw new Error('Dosya içeriği geçersiz veya 100 KB sınırını aşıyor.');
    }
  }
}

function extractToolText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((item): item is { text: string } =>
      isRecord(item) && item.type === 'text' && typeof item.text === 'string',
    )
    .map((item) => item.text)
    .join('\n')
    .slice(0, 10_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
