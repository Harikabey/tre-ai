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
    const { query, userInterests } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Gemini with grounding to search the web
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
  "sources": [
    {"title": "Kaynak başlığı", "url": "https://...", "snippet": "İlgili alıntı"}
  ],
  "confidence": 0-1 arası güven skoru,
  "trending_topics": ["ilgili güncel konular"]
}

${userInterests ? `Kullanıcının ilgi alanları: ${userInterests}. Bu bilgiyi yanıtını kişiselleştirmek için kullan.` : ''}

SADECE JSON döndür.`
          },
          { role: "user", content: query }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Web search error:", response.status, errorText);
      throw new Error("Search failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleanedContent);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      // If parsing fails, return the raw content as answer
      return new Response(JSON.stringify({
        answer: content,
        sources: [],
        confidence: 0.5,
        trending_topics: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Web search error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
