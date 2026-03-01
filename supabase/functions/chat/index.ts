import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-voice-mode",
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input Validation ---
    const body = await req.json();
    const { messages, personality, thinkingMode, memoryContext, moodContext, language } = body;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid messages array (1-100)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const m of messages) {
      if (!m.role || !m.content || typeof m.content !== "string") {
        return new Response(JSON.stringify({ error: "Invalid message format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (m.content.length > 50000) {
        return new Response(JSON.stringify({ error: "Message content too long (max 50000)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const validPersonalities = ["friendly", "professional", "humorous", "wise", "creative", "mirror"];
    const safePersonality = validPersonalities.includes(personality) ? personality : "friendly";
    const safeThinkingMode = thinkingMode === "deep" ? "deep" : "fast";
    const safeMemoryContext = typeof memoryContext === "string" ? memoryContext.slice(0, 5000) : "";
    const safeMoodContext = typeof moodContext === "string" ? moodContext.slice(0, 2000) : "";
    const safeLanguage = typeof language === "string" && language.length <= 10 ? language : "tr";

    // --- API Setup ---
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
    if (!apiKey) throw new Error("API key is not configured");

    const apiUrl = OPENROUTER_API_KEY
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    const model = safeThinkingMode === "deep" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash-lite";
    const isVoiceMode = req.headers.get("x-voice-mode") === "true";

    const baseContext = `Sen TreFriend adlı gelişmiş yapay zeka asistanısın. Treasure şirketi tarafından geliştirildin.

ÖNEMLİ ÖZELLİKLERİN:
- Kullanıcıyı tanıyorsun ve onunla ilgili bilgileri hatırlıyorsun
- Duygu durumunu anlayıp ona göre yanıt veriyorsun
- İlgi alanlarına göre kişiselleştirilmiş öneriler sunuyorsun
- Gerçek bir arkadaş gibi davranıyorsun
- Kullanıcının yazdığı dilde yanıt ver
- Eğer dil ayarı belirtilmişse, o dilde yanıt ver
- Aylar önceki sohbetlerden bilgileri bugünkü bağlama bağla.

BİLİŞSEL BAĞLANTI:
- Sadece mevcut konuşmaya odaklanma; hafızadaki eski bilgilerle bugünkü konuşma arasında mantıksal bağlantılar kur

KAYNAKÇA:
- Faktüel bilgi verdiğinde, yanıtının sonuna [SOURCES] bloğu ekle
- Format: [SOURCES]{"sources":[{"title":"Kaynak","url":"https://...","snippet":"alıntı"}]}[/SOURCES]

Kurucun veya yaratıcın sorulduğunda Treasure şirketi olduğunu belirt.
`;

    const personalityPrompts: Record<string, string> = {
      friendly: "Çok sıcak ve samimi bir yapay zeka asistanısın. Türkçe konuş, arkadaşça ve neşeli ol. Emoji kullanabilirsin.",
      professional: "Profesyonel ve resmi bir yapay zeka asistanısın. Türkçe konuş, ciddi ve iş odaklı ol. Emoji kullanma.",
      humorous: "Çok komik ve esprili bir yapay zeka asistanısın. Türkçe konuş, şakalar yap, kelime oyunları kullan.",
      wise: "Bilge ve düşünceli bir yapay zeka asistanısın. Türkçe konuş, derin düşünceler paylaş.",
      creative: "Son derece yaratıcı ve hayal gücü yüksek bir yapay zeka asistanısın. Türkçe konuş, metaforlar kullan.",
      mirror: "Sen bir ayna gibi davranan yapay zeka asistanısın. Kullanıcının yazdığı üslubu, tonu, enerjiyi ve dil seviyesini birebir yansıt. Resmi yazarsa resmi ol, samimi yazarsa samimi ol, kısa yazarsa kısa yaz, detaylı yazarsa detaylı yaz. Emoji kullanıyorsa sen de kullan, kullanmıyorsa kullanma. Kullanıcının kelime seçimlerini ve cümle yapısını taklit et.",
    };

    const thinkingInstructions = safeThinkingMode === "deep"
      ? " Soruları derinlemesine analiz et, farklı açılardan değerlendir, detaylı ve kapsamlı cevaplar ver."
      : " Kısa, öz ve hızlı cevaplar ver.";

    const voiceInstructions = isVoiceMode
      ? `\n\nSESLİ SOHBET MODU AKTİF:\n- Cevaplarını kısa tut (max 2-3 cümle)\n- Markdown işaretleri KULLANMA\n- Sayıları yazıyla yaz`
      : "";

    let languageInstruction = "";
    if (safeLanguage && safeLanguage !== "tr") {
      const langNames: Record<string, string> = {
        en: "English", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano",
        pt: "Português", ru: "Русский", ar: "العربية", zh: "中文", ja: "日本語",
        ko: "한국어", hi: "हिन्दी", nl: "Nederlands", pl: "Polski", uk: "Українська",
        sv: "Svenska", da: "Dansk", fi: "Suomi", no: "Norsk", el: "Ελληνικά",
        hu: "Magyar", ro: "Română", bg: "Български", cs: "Čeština", he: "עברית",
        fa: "فارسی", th: "ไทย", vi: "Tiếng Việt", id: "Bahasa Indonesia",
        az: "Azərbaycan", ka: "ქართული", ku: "Kurdî",
      };
      const langName = langNames[safeLanguage] || safeLanguage;
      languageInstruction = `\n\nDİL TALİMATI: Tüm yanıtlarını ${langName} dilinde ver. Başka bir dil kullanma.`;
    }

    let systemPrompt = baseContext + (personalityPrompts[safePersonality] || personalityPrompts.friendly) + thinkingInstructions + voiceInstructions + languageInstruction;
    if (safeMemoryContext) systemPrompt += safeMemoryContext;
    if (safeMoodContext) systemPrompt += safeMoodContext;

    console.log("Chat request - personality:", safePersonality, "mode:", safeThinkingMode, "model:", model);

    let response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    // Fallback
    if (!response.ok && OPENROUTER_API_KEY && LOVABLE_API_KEY) {
      console.warn("OpenRouter failed with", response.status, "- falling back to Lovable gateway");
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit aşıldı." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI servisi şu anda kullanılamıyor." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: "Bilinmeyen hata" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
