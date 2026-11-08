import type { ModelSelection } from '@/hooks/useModelSelection';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PROVIDER_URLS = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
} as const;
const MAX_PAYLOAD_LENGTH = 1024 * 1024 - 1;

interface ChatMessage {
  role: string;
  content: string;
}

function sanitizeText(text: string): string {
  return text
    .replace(/data:[^,\s]*;base64,[A-Za-z0-9+/=\r\n]+/gi, '[görsel kaldırıldı]')
    .replace(/[A-Za-z0-9+/]{1024,}={0,2}/g, '[veri kaldırıldı]');
}

function sanitizePayloadValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizePayloadValue);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => {
          const keyParts = key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .toLowerCase()
            .split(/[^a-z0-9]+/);
          return !(
            keyParts.some(part => ['file', 'files', 'image', 'images', 'base64', 'binary'].includes(part)) ||
            (keyParts.includes('data') && keyParts.includes('url'))
          );
        })
        .map(([key, nestedValue]) => [key, sanitizePayloadValue(nestedValue)]),
    );
  }
  return value;
}

function getTextMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message): message is { role: unknown; content: unknown } =>
      typeof message === 'object' && message !== null && !Array.isArray(message),
    )
    .filter(
      (message): message is { role: 'user' | 'assistant'; content: string } =>
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string',
    )
    .slice(-10)
    .map(({ role, content }) => ({ role, content: sanitizeText(content) }));
}

function serializePayload(payload: { messages: ChatMessage[]; [key: string]: unknown }): string {
  let serialized = JSON.stringify(payload);
  while (
    serialized.length > MAX_PAYLOAD_LENGTH &&
    payload.messages.filter(message => message.role !== 'system').length > 1
  ) {
    const oldestConversationMessage = payload.messages.findIndex(message => message.role !== 'system');
    payload.messages.splice(oldestConversationMessage, 1);
    serialized = JSON.stringify(payload);
  }

  if (serialized.length > MAX_PAYLOAD_LENGTH) {
    const lastMessage = [...payload.messages].reverse().find(message => message.role !== 'system')
      ?? payload.messages.at(-1);
    if (lastMessage) {
      const originalContent = lastMessage.content;
      let low = 0;
      let high = originalContent.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        lastMessage.content = originalContent.slice(0, mid);
        if (JSON.stringify(payload).length <= MAX_PAYLOAD_LENGTH) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      lastMessage.content = originalContent.slice(0, low);
      serialized = JSON.stringify(payload);
    }
  }

  if (serialized.length > MAX_PAYLOAD_LENGTH) {
    throw new Error('Chat request payload exceeds 1 MB after removing attachments and history');
  }
  console.info(`Chat request payload size: ${serialized.length} characters`);
  return serialized;
}

interface ChatRequestOptions {
  modelSelection: ModelSelection;
  body: Record<string, unknown>;
  headers: HeadersInit;
}

export async function requestChatCompletion({
  modelSelection,
  body,
  headers,
}: ChatRequestOptions): Promise<Response> {
  if (modelSelection.provider === 'byok') {
    const apiKey = modelSelection.apiKey.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'BYOK API key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const messages = getTextMessages(body.messages);
    if (!messages.length) {
      return new Response(JSON.stringify({ error: 'Chat messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sanitizedBody = sanitizePayloadValue(body) as Record<string, unknown>;
    const systemContext = [
      "You are Tre, the user's helpful AI assistant.",
      typeof sanitizedBody.language === 'string' ? `Respond in ${sanitizedBody.language}.` : null,
      typeof sanitizedBody.personality === 'string' ? `Use a ${sanitizedBody.personality} personality.` : null,
      typeof sanitizedBody.customPersonality === 'string' ? sanitizedBody.customPersonality : null,
      typeof sanitizedBody.memoryContext === 'string' ? sanitizedBody.memoryContext : null,
      typeof sanitizedBody.moodContext === 'string' ? sanitizedBody.moodContext : null,
    ].filter((part): part is string => Boolean(part)).join('\n\n');

    const payload = {
      model: modelSelection.apiProvider === 'groq'
        ? 'openai/gpt-oss-120b'
        : sanitizedBody.thinkingMode === 'deep'
          ? 'google/gemini-2.5-pro'
          : 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system' as const, content: systemContext },
        ...messages,
      ],
      stream: true,
    };
    const serializedPayload = serializePayload(payload);

    const response = await fetch(PROVIDER_URLS[modelSelection.apiProvider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(modelSelection.apiProvider === 'openrouter' && typeof window !== 'undefined'
          ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'Tre' }
          : {}),
      },
      body: serializedPayload,
    });

    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      return new Response(JSON.stringify({ error: 'Anahtar geçersiz', code: 'INVALID_API_KEY' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return response;
  }

  if (modelSelection.provider !== 'default') {
    throw new Error(`Unsupported chat provider: ${modelSelection.provider}`);
  }

  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey) throw new Error('Supabase anon key is not configured');

  const supabaseHeaders = new Headers(headers);
  supabaseHeaders.set('apikey', apiKey);
  if (!supabaseHeaders.get('Authorization')?.startsWith('Bearer ')) {
    throw new Error('A valid Supabase user session is required');
  }

  const sanitizedBody = sanitizePayloadValue(body) as Record<string, unknown>;
  const messages = getTextMessages(body.messages);
  if (Array.isArray(body.messages) && messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Chat messages are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const payload = {
    ...sanitizedBody,
    ...(Array.isArray(body.messages) ? { messages } : {}),
    provider: 'default',
  };
  const serializedPayload = serializePayload(payload);

  return fetch(CHAT_URL, {
    method: 'POST',
    headers: supabaseHeaders,
    body: serializedPayload,
  });
}
