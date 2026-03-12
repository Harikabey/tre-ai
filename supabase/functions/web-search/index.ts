import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !data?.claims?.sub) {
      console.error("Auth error:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input Validation ---
    const { query, userInterests } = await req.json();
    if (!query || typeof query !== "string" || query.length > 2000) {
      return new Response(JSON.stringify({ error: "Valid query required (max 2000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeInterests = typeof userInterests === "string" ? userInterests.slice(0, 1000) : "";

    // --- API Setup ---
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
    const apiUrl = OPENROUTER_API_KEY
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    if (!apiKey) throw new Error("API key is not configured");

    const requestBody = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Sen bir araştırma asistanısın. Kullanıcının sorusuna güncel ve doğru bilgilerle yanıt ver.

ÖNEMLİ KURALLAR:
1. Her bilgi için güvenilir kaynak belirt
2. Yanıtını şu JSON formatında ver:
{
  "answer": "Ana yanıt metni (markdown destekli)",
  "sources": [{"title": "Kaynak başlığı", "url": "https://...", "snippet": "İlgili alıntı"}],
  "confidence": 0-1 arası güven skoru,
  "trending_topics": ["ilgili güncel konular"]
}

${safeInterests ? `Kullanıcının ilgi alanları: ${safeInterests}.` : ""}

SADECE JSON döndür.`,
        },
        { role: "user", content: query },
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
        console.error("OpenRouter error:", response.status, "- falling back");
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
      console.error("Web search error:", response?.status);
      throw new Error("Search failed");
    }

    const responseData = await response.json();
    const content = responseData.choices?.[0]?.message?.content || "";

    try {
      const result = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(
        JSON.stringify({ answer: content, sources: [], confidence: 0.5, trending_topics: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Web search error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
