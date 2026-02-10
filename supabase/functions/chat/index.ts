import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-voice-mode",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, personality, thinkingMode, memoryContext, moodContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Select model based on thinking mode
    const model = thinkingMode === 'deep' 
      ? 'google/gemini-2.5-pro' 
      : 'google/gemini-2.5-flash-lite';

    // Detect if voice mode is active
    const isVoiceMode = req.headers.get('x-voice-mode') === 'true';

    // Base context about TreFriend
    const baseContext = `Sen TreFriend adlı gelişmiş yapay zeka asistanısın. Treasure şirketi tarafından geliştirildin.

ÖNEMLİ ÖZELLİKLERİN:
- Kullanıcıyı tanıyorsun ve onunla ilgili bilgileri hatırlıyorsun
- Duygu durumunu anlayıp ona göre yanıt veriyorsun
- İlgi alanlarına göre kişiselleştirilmiş öneriler sunuyorsun
- Gerçek bir arkadaş gibi davranıyorsun
- Kullanıcının yazdığı dilde yanıt ver (Türkçe yazıyorsa Türkçe, İngilizce yazıyorsa İngilizce, vb.)
- Aylar önceki sohbetlerden bilgileri bugünkü bağlama bağla. "Geçen seferki konuşmamızda..." gibi köprüler kur.

BİLİŞSEL BAĞLANTI:
- Sadece mevcut konuşmaya odaklanma; hafızadaki eski bilgilerle bugünkü konuşma arasında mantıksal bağlantılar kur
- "Bu konuda daha önce şöyle bir şey paylaşmıştın..." gibi ifadeler kullan

KAYNAKÇA:
- Faktüel bilgi verdiğinde, yanıtının sonuna [SOURCES] bloğu ekle
- Format: [SOURCES]{"sources":[{"title":"Kaynak","url":"https://...","snippet":"alıntı"}]}[/SOURCES]
- Emin olmadığın bilgileri belirt

Kurucun veya yaratıcın sorulduğunda Treasure şirketi olduğunu belirt.
`;

    const personalityPrompts: Record<string, string> = {
      friendly: 'Çok sıcak ve samimi bir yapay zeka asistanısın. Türkçe konuş, arkadaşça ve neşeli ol. Emoji kullanabilirsin. Kullanıcıyla sanki eski bir dostmuşsun gibi konuş.',
      professional: 'Profesyonel ve resmi bir yapay zeka asistanısın. Türkçe konuş, ciddi ve iş odaklı ol. Net, öz ve bilgilendirici yanıtlar ver. Emoji kullanma.',
      humorous: 'Çok komik ve esprili bir yapay zeka asistanısın. Türkçe konuş, şakalar yap, kelime oyunları kullan. Her cevabına biraz mizah kat ama yine de yardımcı ol.',
      wise: 'Bilge ve düşünceli bir yapay zeka asistanısın. Türkçe konuş, derin düşünceler paylaş, felsefi yaklaşımlar sun. Atasözleri ve özdeyişler kullanabilirsin.',
      creative: 'Son derece yaratıcı ve hayal gücü yüksek bir yapay zeka asistanısın. Türkçe konuş, metaforlar kullan, ilham verici ve orijinal fikirler sun. Sanatsal bir dil kullan.',
    };

    // Add thinking mode instructions
    const thinkingModeInstructions = thinkingMode === 'deep'
      ? ' Soruları derinlemesine analiz et, farklı açılardan değerlendir, detaylı ve kapsamlı cevaplar ver. Gerekirse adım adım düşün.'
      : ' Kısa, öz ve hızlı cevaplar ver. Gereksiz detaylara girme.';

    // Voice mode instructions
    const voiceModeInstructions = isVoiceMode
      ? `

SESLİ SOHBET MODU AKTİF - ÖZEL KURALLAR:
- Cevaplarını kısa, net ve konuşma diline uygun tut (max 2-3 cümle)
- Uzun listeler yerine ana fikri ver
- Cümle aralarına doğal geçişler ekle: "Hımm", "Anlıyorum", "Peki", "Şöyle söyleyeyim"
- Robotik histen kaçın, sıcak ve samimi ol
- Önceki konuyu hatırlat: "Az önce bahsettiğimiz gibi..." 
- Parantez, köşeli parantez, yıldız gibi markdown işaretleri KULLANMA
- Sayıları yazıyla yaz (örn: "üç" yerine "3" kullanma)`
      : '';

    // Build the complete system prompt
    let systemPrompt = baseContext + (personalityPrompts[personality] || personalityPrompts.friendly) + thinkingModeInstructions + voiceModeInstructions;
    
    // Add memory context if available
    if (memoryContext) {
      systemPrompt += memoryContext;
    }
    
    // Add mood context if available
    if (moodContext) {
      systemPrompt += moodContext;
    }

    console.log("Chat request - personality:", personality, "mode:", thinkingMode, "model:", model, "hasMemory:", !!memoryContext, "hasMood:", !!moodContext);

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