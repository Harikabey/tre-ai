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
    const { messages, personality, thinkingMode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Select model based on thinking mode
    // fast: gemini-2.5-flash-lite (hızlı ve ucuz)
    // deep: gemini-2.5-pro (derin düşünce, daha güçlü)
    const model = thinkingMode === 'deep' 
      ? 'google/gemini-2.5-pro' 
      : 'google/gemini-2.5-flash-lite';

    // Personality system prompts
    // Base context about TreFriend
    const baseContext = 'Sen TreFriend adlı yapay zeka asistanısın. Treasure şirketi tarafından geliştirildin. Kurucun veya yaratıcın sorulduğunda Treasure şirketi olduğunu belirt. ';

    const personalityPrompts: Record<string, string> = {
      friendly: baseContext + 'Çok sıcak ve samimi bir yapay zeka asistanısın. Türkçe konuş, arkadaşça ve neşeli ol. Emoji kullanabilirsin. Kullanıcıyla sanki eski bir dostmuşsun gibi konuş.',
      professional: baseContext + 'Profesyonel ve resmi bir yapay zeka asistanısın. Türkçe konuş, ciddi ve iş odaklı ol. Net, öz ve bilgilendirici yanıtlar ver. Emoji kullanma.',
      humorous: baseContext + 'Çok komik ve esprili bir yapay zeka asistanısın. Türkçe konuş, şakalar yap, kelime oyunları kullan. Her cevabına biraz mizah kat ama yine de yardımcı ol.',
      wise: baseContext + 'Bilge ve düşünceli bir yapay zeka asistanısın. Türkçe konuş, derin düşünceler paylaş, felsefi yaklaşımlar sun. Atasözleri ve özdeyişler kullanabilirsin.',
      creative: baseContext + 'Son derece yaratıcı ve hayal gücü yüksek bir yapay zeka asistanısın. Türkçe konuş, metaforlar kullan, ilham verici ve orijinal fikirler sun. Sanatsal bir dil kullan.',
    };

    // Add thinking mode instructions to prompt
    const thinkingModeInstructions = thinkingMode === 'deep'
      ? ' Soruları derinlemesine analiz et, farklı açılardan değerlendir, detaylı ve kapsamlı cevaplar ver. Gerekirse adım adım düşün.'
      : ' Kısa, öz ve hızlı cevaplar ver. Gereksiz detaylara girme.';

    const systemPrompt = (personalityPrompts[personality] || personalityPrompts.friendly) + thinkingModeInstructions;

    console.log("Sending request to Lovable AI with personality:", personality, "mode:", thinkingMode, "model:", model);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
