import { callAiWithFallback } from "../_shared/aiFallback.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MoodAnalysis {
  mood: string;
  mood_score: number;
  emotions: string[];
  suggested_tone: string;
}

interface MemoryExtraction {
  memories: Array<{
    type: 'fact' | 'preference' | 'interest' | 'habit' | 'relationship' | 'goal';
    category: string;
    content: string;
    importance: number;
  }>;
  interests: Array<{ interest: string; category: string }>;
}

const MEMORY_TYPES: MemoryExtraction["memories"][number]["type"][] = [
  "fact",
  "preference",
  "interest",
  "habit",
  "relationship",
  "goal",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth Check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input Validation ---
    const body: unknown = await req.json();
    const message = isRecord(body) ? body.message : undefined;
    const conversationHistory = isRecord(body) ? body.conversationHistory : undefined;
    if (!message || typeof message !== "string" || message.length > 10000) {
      return new Response(JSON.stringify({ error: "Valid message required (max 10000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Limit conversation history
    const safeHistory = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-10).filter(
        (item: unknown): item is { role: string; content: string } =>
          isRecord(item) && typeof item.role === "string" && typeof item.content === "string",
      )
      : [];

    const [moodResult, memoryResult] = await Promise.all([
      analyzeMood(message),
      extractMemories(message, safeHistory),
    ]);

    return new Response(JSON.stringify({ mood: moodResult, memories: memoryResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analyze mood error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function analyzeMood(message: string): Promise<MoodAnalysis> {
  const requestBody = JSON.stringify({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      {
        role: "system",
        content: `Sen bir duygu analizi uzmanısın. Kullanıcının mesajını analiz et ve JSON formatında yanıt ver.

Yanıt formatı:
{
  "mood": "mutlu|üzgün|kızgın|endişeli|heyecanlı|sakin|yorgun|stresli|nötr|meraklı|umutlu|hayal_kırıklığı",
  "mood_score": -1 ile 1 arası sayı,
  "emotions": ["tespit edilen duygular listesi"],
  "suggested_tone": "destekleyici/neşeli/sakin/motive_edici/empatik/bilgilendirici"
}

SADECE JSON döndür.`,
      },
      { role: "user", content: message },
    ],
  });

  const response = await callAiWithFallback(requestBody, {
    operation: "Mood analysis",
    isUsable: async (candidate) => isMoodAnalysis(await parseAiJson(candidate)),
  });

  if (!response?.ok) throw await aiResponseError("Mood analysis", response);
  const parsed = await parseAiJson(response);
  if (!isMoodAnalysis(parsed)) {
    throw new Error("Mood analysis returned an invalid response.");
  }
  return {
    mood: parsed.mood,
    mood_score: parsed.mood_score,
    emotions: parsed.emotions,
    suggested_tone: parsed.suggested_tone,
  };
}

async function extractMemories(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<MemoryExtraction> {
  const recentContext = conversationHistory
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Kullanıcı" : "AI"}: ${m.content.slice(0, 500)}`)
    .join("\n");

  const requestBody = JSON.stringify({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      {
        role: "system",
        content: `Sen bir bilgi çıkarma uzmanısın. Kullanıcının mesajından hatırlanması gereken bilgileri çıkar.

Türler: fact, preference, interest, habit, relationship, goal

Yanıt formatı (SADECE JSON):
{
  "memories": [{"type": "...", "category": "...", "content": "...", "importance": 1-10}],
  "interests": [{"interest": "...", "category": "..."}]
}

Eğer önemli bilgi yoksa boş array döndür.`,
      },
      {
        role: "user",
        content: recentContext ? `Önceki konuşma:\n${recentContext}\n\nSon mesaj: ${message}` : message,
      },
    ],
  });

  const response = await callAiWithFallback(requestBody, {
    operation: "Memory extraction",
    isUsable: async (candidate) => isMemoryExtraction(await parseAiJson(candidate)),
  });

  if (!response?.ok) throw await aiResponseError("Memory extraction", response);
  const parsed = await parseAiJson(response);
  if (!isMemoryExtraction(parsed)) {
    throw new Error("Memory extraction returned an invalid response.");
  }
  return parsed;
}

async function parseAiJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.choices)) return null;
    const firstChoice: unknown = data.choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
    const content = firstChoice.message.content;
    if (typeof content !== "string") return null;
    const parsed: unknown = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function aiResponseError(operation: string, response: Response | null): Promise<Error> {
  if (!response) return new Error(`${operation} failed: no AI provider response.`);
  const details = (await response.text()).slice(0, 300);
  return new Error(`${operation} failed with status ${response.status}: ${details}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMoodAnalysis(value: Record<string, unknown> | null): value is Record<string, unknown> & MoodAnalysis {
  return value !== null &&
    typeof value.mood === "string" &&
    typeof value.mood_score === "number" &&
    Number.isFinite(value.mood_score) &&
    value.mood_score >= -1 &&
    value.mood_score <= 1 &&
    Array.isArray(value.emotions) &&
    value.emotions.every((emotion) => typeof emotion === "string") &&
    typeof value.suggested_tone === "string";
}

function isMemoryExtraction(
  value: Record<string, unknown> | null,
): value is Record<string, unknown> & MemoryExtraction {
  return value !== null &&
    Array.isArray(value.memories) &&
    value.memories.every((memory: unknown) =>
      isRecord(memory) &&
      isMemoryType(memory.type) &&
      typeof memory.category === "string" &&
      typeof memory.content === "string" &&
      typeof memory.importance === "number" &&
      Number.isInteger(memory.importance) &&
      memory.importance >= 1 &&
      memory.importance <= 10
    ) &&
    Array.isArray(value.interests) &&
    value.interests.every((interest: unknown) =>
      isRecord(interest) &&
      typeof interest.interest === "string" &&
      typeof interest.category === "string"
    );
}

function isMemoryType(value: unknown): value is MemoryExtraction["memories"][number]["type"] {
  return MEMORY_TYPES.some((type) => type === value);
}
