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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input Validation ---
    const { message, conversationHistory } = await req.json();
    if (!message || typeof message !== "string" || message.length > 10000) {
      return new Response(JSON.stringify({ error: "Valid message required (max 10000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Limit conversation history
    const safeHistory = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-10).filter((m: any) => typeof m.role === "string" && typeof m.content === "string")
      : [];

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
    const apiUrl = OPENROUTER_API_KEY
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    if (!apiKey) throw new Error("API key is not configured");

    const [moodResult, memoryResult] = await Promise.all([
      analyzeMood(message, apiKey, apiUrl),
      extractMemories(message, safeHistory, apiKey, apiUrl),
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

async function analyzeMood(message: string, apiKey: string, apiUrl: string): Promise<MoodAnalysis> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

  let response: Response | null = null;

  if (OPENROUTER_API_KEY) {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: requestBody,
    });
    if (!response.ok) {
      console.error("OpenRouter mood error:", response.status, "- falling back");
      response = null;
    }
  }

  if (!response && LOVABLE_API_KEY) {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: requestBody,
    });
  }

  if (!response || !response.ok) {
    return { mood: "nötr", mood_score: 0, emotions: [], suggested_tone: "bilgilendirici" };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    return { mood: "nötr", mood_score: 0, emotions: [], suggested_tone: "bilgilendirici" };
  }
}

async function extractMemories(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string,
  apiUrl: string
): Promise<MemoryExtraction> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

  let response: Response | null = null;

  if (OPENROUTER_API_KEY) {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: requestBody,
    });
    if (!response.ok) {
      console.error("OpenRouter memory error:", response.status, "- falling back");
      response = null;
    }
  }

  if (!response && LOVABLE_API_KEY) {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: requestBody,
    });
  }

  if (!response || !response.ok) return { memories: [], interests: [] };

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    return { memories: [], interests: [] };
  }
}
