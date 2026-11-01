import { FREE_MODELS, withFreeModel } from "./freeAi.ts";

type ModelKind = keyof typeof FREE_MODELS;

interface AiFallbackOptions {
  operation: string;
  openRouterKind?: ModelKind;
  groqModel?: string;
  isUsable?: (response: Response) => Promise<boolean>;
}

export async function callAiWithFallback(
  requestBody: string,
  { operation, openRouterKind = "chat", groqModel = "llama-3.3-70b-versatile", isUsable }: AiFallbackOptions,
): Promise<Response | null> {
  const providers = [
    {
      name: "Groq",
      apiKey: Deno.env.get("GROQ_API_KEY"),
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      body: withModel(requestBody, groqModel),
    },
    {
      name: "OpenRouter",
      apiKey: Deno.env.get("OPENROUTER_API_KEY"),
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      body: withFreeModel(requestBody, openRouterKind),
    },
  ].filter((provider) => provider.apiKey);

  let lastResponse: Response | null = null;
  for (const provider of providers) {
    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: provider.body,
      });
      lastResponse = response;
      if (!response.ok) {
        console.error(`${operation} ${provider.name} error:`, response.status, (await response.clone().text()).slice(0, 300));
        continue;
      }
      if (isUsable && !await isUsable(response.clone())) {
        console.error(`${operation} ${provider.name} returned no usable result`);
        continue;
      }
      return response;
    } catch (error) {
      console.error(`${operation} ${provider.name} request failed:`, error);
    }
  }
  return lastResponse;
}

function withModel(body: string, model: string): string {
  const parsed = JSON.parse(body);
  parsed.model = model;
  return JSON.stringify(parsed);
}
