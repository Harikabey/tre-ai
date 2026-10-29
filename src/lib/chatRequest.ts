import type { ModelSelection } from '@/hooks/useModelSelection';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PROVIDER_URLS = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
} as const;

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
    if (!Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: 'Chat messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemContext = [
      "You are Tre, the user's helpful AI assistant.",
      typeof body.language === 'string' ? `Respond in ${body.language}.` : null,
      typeof body.personality === 'string' ? `Use a ${body.personality} personality.` : null,
      typeof body.customPersonality === 'string' ? body.customPersonality : null,
      typeof body.memoryContext === 'string' ? body.memoryContext : null,
      typeof body.moodContext === 'string' ? body.moodContext : null,
    ].filter((part): part is string => Boolean(part)).join('\n\n');

    const response = await fetch(PROVIDER_URLS[modelSelection.apiProvider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(modelSelection.apiProvider === 'openrouter' && typeof window !== 'undefined'
          ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'Tre' }
          : {}),
      },
      body: JSON.stringify({
        model: modelSelection.apiProvider === 'groq'
          ? 'llama-3.3-70b-versatile'
          : body.thinkingMode === 'deep'
            ? 'google/gemini-2.5-pro'
            : 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemContext },
          ...body.messages,
        ],
        stream: true,
      }),
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

  return fetch(CHAT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, provider: 'default' }),
  });
}
