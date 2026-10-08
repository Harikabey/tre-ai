// Free-only AI access layer.
// Every AI call in this project must go through OpenRouter's free-tier models.
// Paid fallbacks (Lovable AI Gateway / paid OpenRouter models) are intentionally disabled.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Free models actually served by OpenRouter (verified against /v1/models). */
export const FREE_MODELS = {
  chat: "nvidia/nemotron-3.5-lightning:free",
  fast: "nvidia/nemotron-3.5-lightning:free",
  reasoning: "nvidia/nemotron-3-ultra-550b-a55b:free",
  vision: "google/gemma-4-31b-it:free",
} as const;

/** Ordered fallbacks sent via OpenRouter `models`; last entry is the auto free router (never goes stale). */
export const FREE_FALLBACKS: Record<keyof typeof FREE_MODELS, string[]> = {
  chat: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free", "openrouter/free"],
  fast: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-26b-a4b-it:free", "openrouter/free"],
  reasoning: ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free", "openrouter/free"],
  vision: ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "openrouter/free"],
};

export const FREE_BUSY_MESSAGE =
  "Ücretsiz model şu anda meşgul, lütfen birazdan tekrar deneyin.";

export const FREE_UNAVAILABLE_MESSAGE =
  "Bu özellik şu anda ücretsiz modelde kullanılamıyor.";

/** Ensures a model id targets the free tier. */
export function toFreeModel(id: string): string {
  return id.endsWith(":free") ? id : `${id}:free`;
}

/**
 * Rewrites the `model` field of a JSON request body to a supported free model.
 * `kind` picks the free replacement when the original model has no free variant.
 */
export function withFreeModel(body: string, kind: keyof typeof FREE_MODELS = "chat"): string {
  try {
    const o = JSON.parse(body);
    o.model = FREE_MODELS[kind];
    o.models = FREE_FALLBACKS[kind];
    return JSON.stringify(o);
  } catch {
    return body.replace(/"model"\s*:\s*"[^"]+"/, `"model":"${FREE_MODELS[kind]}"`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls OpenRouter with a free model. Retries transient failures (429 / 5xx)
 * a couple of times and then fails — it never falls back to a paid provider.
 */
export async function callFreeAi(
  body: string | Record<string, unknown>,
  kind: keyof typeof FREE_MODELS = "chat",
): Promise<Response> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY yapılandırılmamış.");

  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const payload = withFreeModel(raw, kind);

  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt * 1500);
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: payload,
    });
    if (res.ok) return res;
    last = res;
    const retryable = res.status === 429 || res.status >= 500;
    const text = await res.text();
    console.error("Free AI error", res.status, text.slice(0, 300));
    if (!retryable) break;
  }
  throw new Error(last && last.status === 429 ? FREE_BUSY_MESSAGE : FREE_BUSY_MESSAGE);
}
