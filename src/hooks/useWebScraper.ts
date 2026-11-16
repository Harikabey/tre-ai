export interface ScrapedSource {
  sourceId: string;
  title: string;
  text: string;
}

export type ScrapeProgress = (message: string) => void;

const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_REPOSITORY_BYTES = 350 * 1024;
const MAX_REPOSITORY_FILES = 24;
const CODE_EXTENSIONS = new Set([
  'c', 'cc', 'cpp', 'css', 'go', 'h', 'hbs', 'html', 'java', 'js', 'jsx',
  'json', 'md', 'mjs', 'php', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift',
  'toml', 'ts', 'tsx', 'vue', 'xml', 'yaml', 'yml',
]);

function validatePublicUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Geçerli bir http:// veya https:// adresi girin.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Yalnızca kullanıcı bilgisi içermeyen http:// ve https:// adresleri desteklenir.');
  }
  const hostname = url.hostname.toLowerCase();
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  const isPrivateIpv4 = ipv4 && (
    Number(ipv4[1]) === 10 ||
    (Number(ipv4[1]) === 172 && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31) ||
    (Number(ipv4[1]) === 192 && Number(ipv4[2]) === 168) ||
    Number(ipv4[1]) === 127 ||
    Number(ipv4[1]) === 0 ||
    (Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254)
  );
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '::1' ||
    hostname.startsWith('[') ||
    isPrivateIpv4
  ) {
    throw new Error('Güvenlik nedeniyle yerel ağ adresleri taranamıyor.');
  }
  url.hash = '';
  return url;
}

async function fetchText(
  url: string,
  maxBytes: number,
  onResponse?: (response: Response) => void,
): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'follow',
      headers: { Accept: 'text/html, text/plain, application/json, */*' },
    });
    if (!response.ok) throw new Error(`Kaynak alınamadı (HTTP ${response.status}).`);
    if (!response.body) throw new Error('Sunucu yanıt gövdesi boş.');
    if (response.url) validatePublicUrl(response.url);
    onResponse?.(response);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let totalBytes = 0;
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error('Kaynak izin verilen boyut sınırını aşıyor.');
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Kaynak isteği zaman aşımına uğradı.');
    }
    if (error instanceof TypeError) {
      throw new Error('Kaynağa erişilemedi. Site CORS isteğini engelliyor olabilir.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractHtmlText(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll(
    'script, style, nav, footer, header, aside, noscript, svg, canvas, iframe, form, button, [hidden], [aria-hidden="true"]',
  ).forEach((element) => element.remove());

  const contentRoot = Array.from(document.querySelectorAll('main, article, [role="main"]'))
    .sort((left, right) => (right.textContent?.length ?? 0) - (left.textContent?.length ?? 0))[0]
    ?? document.body;
  const content = contentRoot.cloneNode(true) as HTMLElement;
  content.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    const language = code?.className.match(/(?:language|lang)-([\w+-]+)/)?.[1] ?? '';
    pre.replaceWith(`\n\`\`\`${language}\n${pre.textContent ?? ''}\n\`\`\`\n`);
  });
  content.querySelectorAll('code').forEach((code) => {
    code.replaceWith(`\`${code.textContent ?? ''}\``);
  });
  return (content.innerText || content.textContent || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function scrapeGitHubRepository(
  url: URL,
  onProgress: ScrapeProgress,
): Promise<ScrapedSource> {
  const [, owner, repo, resourceType, requestedBranch] = url.pathname.split('/');
  if (!owner || !repo || (resourceType && resourceType !== 'tree')) {
    throw new Error('GitHub için depo ana sayfası veya /tree/dal bağlantısı girin.');
  }
  const repository = repo.replace(/\.git$/i, '');
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  onProgress('GitHub deposu ve dosya listesi alınıyor...');
  const repositoryInfo = JSON.parse(await fetchText(apiBase, 256 * 1024)) as {
    default_branch?: unknown;
    full_name?: unknown;
  };
  const branch = requestedBranch || repositoryInfo.default_branch;
  if (typeof branch !== 'string' || !branch) {
    throw new Error('Depodaki varsayılan dal belirlenemedi.');
  }

  const treeUrl = `${apiBase}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const treeData = JSON.parse(await fetchText(treeUrl, 5 * 1024 * 1024)) as {
    tree?: Array<{ path?: unknown; type?: unknown }>;
  };
  const files = treeData.tree?.filter(
    (entry): entry is { path: string; type: string } =>
      typeof entry.path === 'string' && entry.type === 'blob',
  ) ?? [];
  const readmeFiles = files.flatMap((entry) => {
    if (typeof entry.path !== 'string') return [];
    return /^readme(?:\.[^/]*)?$/i.test(entry.path.split('/').at(-1) ?? '') ? [entry.path] : [];
  });
  const codeFiles = files.flatMap((entry) => {
    if (typeof entry.path !== 'string') return [];
    const { path } = entry;
    const extension = path.split('.').at(-1)?.toLowerCase();
    return extension && CODE_EXTENSIONS.has(extension) && !path.split('/').some((part) =>
      ['node_modules', 'vendor', 'dist', 'build', '.git'].includes(part),
    ) ? [path] : [];
  });
  const selectedFiles = [...new Set([...readmeFiles, ...codeFiles])].slice(0, MAX_REPOSITORY_FILES);
  if (selectedFiles.length === 0) throw new Error('Depoda okunabilir README veya kod dosyası bulunamadı.');

  const rawRoot = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${branch.split('/').map(encodeURIComponent).join('/')}`;
  const texts: string[] = [];
  let totalBytes = 0;
  for (const [index, path] of selectedFiles.entries()) {
    onProgress(`GitHub dosyası alınıyor (${index + 1}/${selectedFiles.length}): ${path}`);
    const remaining = MAX_REPOSITORY_BYTES - totalBytes;
    if (remaining <= 0) break;
    try {
      const text = await fetchText(`${rawRoot}/${path.split('/').map(encodeURIComponent).join('/')}`, Math.min(remaining, 80 * 1024));
      totalBytes += new TextEncoder().encode(text).byteLength;
      texts.push(`## ${path}\n\n${text}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('boyut sınırını')) continue;
      throw error;
    }
  }
  const text = texts.join('\n\n').trim();
  if (!text) throw new Error('Depodan içerik okunamadı.');
  return {
    sourceId: `https://github.com/${owner}/${repository}`,
    title: typeof repositoryInfo.full_name === 'string' ? repositoryInfo.full_name : `${owner}/${repository}`,
    text,
  };
}

export async function scrapeSource(value: string, onProgress: ScrapeProgress = () => {}): Promise<ScrapedSource> {
  const url = validatePublicUrl(value);
  if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
    return scrapeGitHubRepository(url, onProgress);
  }
  onProgress('Sayfa taranıyor...');
  let contentType = '';
  const html = await fetchText(url.href, MAX_PAGE_BYTES, (response) => {
    contentType = response.headers.get('content-type') ?? '';
  });
  if (contentType && !/(text\/html|application\/xhtml\+xml|text\/plain)/i.test(contentType)) {
    throw new Error('Bu bağlantı HTML veya düz metin bir sayfa değil.');
  }
  onProgress('Metin ve kod blokları çıkarılıyor...');
  const text = /text\/plain/i.test(contentType) ? html : extractHtmlText(html);
  if (text.length < 20) throw new Error('Sayfada indekslenebilir metin bulunamadı.');
  return { sourceId: url.href, title: url.hostname, text };
}
