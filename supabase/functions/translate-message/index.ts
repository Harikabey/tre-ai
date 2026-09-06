import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, targetLanguage } = await req.json();
    if (!text || typeof text !== "string" || text.length > 10000) {
      return new Response(JSON.stringify({ error: "Invalid text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!targetLanguage || typeof targetLanguage !== "string") {
      return new Response(JSON.stringify({ error: "Invalid target language" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const isJson = text.trim().startsWith('{') && text.trim().endsWith('}');
    const systemPrompt = isJson
      ? `You are a translator. The input is a JSON object with string values. Translate ALL string values to ${targetLanguage}. Keep the JSON keys exactly the same. Output ONLY valid JSON, nothing else. No markdown code blocks.`
      : `You are a translator. Translate the given text to ${targetLanguage}. Output ONLY the translated text, nothing else. Preserve markdown formatting.`;

    const requestBody = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });

    let response: Response | null = null;

    // Try OpenRouter first
    if (OPENROUTER_API_KEY) {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: requestBody.replace(/"model":"([^"]+)"/, '"model":"$1:free"'),
      });

      if (!response.ok) {
        console.warn("OpenRouter failed:", response.status, await response.text());
        response = null; // fallback
      }
    }

    // Fallback to Lovable AI Gateway
    if (!response && LOVABLE_API_KEY) {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });
    }

    if (!response || !response.ok) {
      const status = response?.status || 500;
      const errText = response ? await response.text() : "No API key available";
      console.error("Translation API error:", status, errText);
      
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit aşıldı, lütfen bekleyin." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Çeviri servisi kullanılamıyor." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ translatedText: translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Translate error:", error);
    return new Response(JSON.stringify({ error: "Translation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
