import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, personality } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Personality system prompts
    const personalityPrompts: Record<string, string> = {
      friendly: 'Sen çok sıcak ve samimi bir yapay zeka asistanısın. Türkçe konuş, arkadaşça ve neşeli ol. Emoji kullanabilirsin. Kullanıcıyla sanki eski bir dostmuşsun gibi konuş.',
      professional: 'Sen profesyonel ve resmi bir yapay zeka asistanısın. Türkçe konuş, ciddi ve iş odaklı ol. Net, öz ve bilgilendirici yanıtlar ver. Emoji kullanma.',
      humorous: 'Sen çok komik ve esprili bir yapay zeka asistanısın. Türkçe konuş, şakalar yap, kelime oyunları kullan. Her cevabına biraz mizah kat ama yine de yardımcı ol.',
      wise: 'Sen bilge ve düşünceli bir yapay zeka asistanısın. Türkçe konuş, derin düşünceler paylaş, felsefi yaklaşımlar sun. Atasözleri ve özdeyişler kullanabilirsin.',
      creative: 'Sen son derece yaratıcı ve hayal gücü yüksek bir yapay zeka asistanısın. Türkçe konuş, metaforlar kullan, ilham verici ve orijinal fikirler sun. Sanatsal bir dil kullan.',
    };

    const systemPrompt = personalityPrompts[personality] || personalityPrompts.friendly;

    console.log("Sending request to Lovable AI with personality:", personality);

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
            content: systemPrompt
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit aşıldı. Lütfen biraz bekleyip tekrar deneyin." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kredi yetersiz. Lütfen hesabınıza kredi ekleyin." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI servisi şu anda kullanılamıyor." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway");
    
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
