import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = 3000;
const endpoint = '/mcp';
const tools = [
  {
    name: 'simulate_action',
    description: 'Bir TreOS eylemini hiçbir bilgisayar değişikliği yapmadan simüle eder.',
    inputSchema: { type: 'object', properties: { action: { type: 'string' } } },
  },
  {
    name: 'preview_action',
    description: 'Bir TreOS eyleminin simülasyon önizlemesini döndürür.',
    inputSchema: { type: 'object', properties: { action: { type: 'string' } } },
  },
  {
    name: 'get_demo_status',
    description: 'Yerel simülatörün durumunu döndürür.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type, MCP-Protocol-Version');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (request.url !== endpoint) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === 'GET') {
    sendJson(response, 200, { status: 'ready', mode: 'simulation-only' });
    return;
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 100_000) {
      sendJson(response, 413, { error: 'Request too large' });
      request.destroy();
    }
  });
  request.on('end', () => {
    let message;
    try {
      message = JSON.parse(body);
    } catch {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    if (message.method === 'notifications/initialized') {
      response.writeHead(202);
      response.end();
      return;
    }

    if (message.method === 'initialize') {
      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'TreOS Local Simulator', version: '1.0.0' },
        },
      });
      return;
    }

    if (message.method === 'tools/list') {
      sendJson(response, 200, { jsonrpc: '2.0', id: message.id, result: { tools } });
      return;
    }

    if (message.method === 'tools/call') {
      const { name, arguments: args = {} } = message.params ?? {};
      if (!tools.some((tool) => tool.name === name)) {
        sendJson(response, 200, {
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32602, message: 'Tool is not available in simulation mode' },
        });
        return;
      }

      const text = name === 'get_demo_status'
        ? 'Yerel simülatör çalışıyor. Gerçek bilgisayar işlemi yapılmadı.'
        : `${name === 'preview_action' ? 'Önizleme' : 'Simülasyon'}: ${String(args.action ?? 'eylem belirtilmedi')}. Gerçek bilgisayar işlemi yapılmadı.`;
      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: message.id,
        result: { content: [{ type: 'text', text }] },
      });
      return;
    }

    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: 'Method not found' },
    });
  });
});

server.on('error', (error) => {
  console.error(`TreOS yerel simülatörü başlatılamadı: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`TreOS yerel simülatörü hazır: http://${host}:${port}${endpoint}`);
  console.log('Yalnızca simülasyon araçları etkin. Durdurmak için Ctrl+C.');
});
