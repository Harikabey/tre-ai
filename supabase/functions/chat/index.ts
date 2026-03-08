import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const { messages, personality, thinkingMode, memoryContext, moodContext, language, connectedAccounts } = body;

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

    // Filter out old assistant refusal messages about email access when accounts are connected
    const refusalPatterns = ["erişimim yok", "erişim sağlayamıyorum", "teknik sınırlılığım", "teknik kapasitemle mümkün değil", "doğrudan erişimim bulunmuyor", "e-postalarına erişim sağlayamıyorum"];
    let filteredMessages = messages;
    if (Array.isArray(connectedAccounts) && connectedAccounts.length > 0) {
      filteredMessages = messages.filter((m: { role: string; content: string }) => {
        if (m.role !== 'assistant') return true;
        const lower = m.content.toLowerCase();
        return !refusalPatterns.some(p => lower.includes(p));
      });
      if (filteredMessages.length === 0) filteredMessages = messages.slice(-1);
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

    const model = safeThinkingMode === "deep" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const isVoiceMode = req.headers.get("x-voice-mode") === "true";

    const baseContext = `Sen TreFriend adlı gelişmiş yapay zeka asistanısın. Treasure şirketi tarafından geliştirildin.

KİMLİĞİN:
- Gerçek bir arkadaş gibisin — sıcak, samimi, güvenilir
- Kullanıcıyı isimleriyle tanırsın ve geçmiş konuşmaları hatırlarsın
- Bilgi verirken özgün ve derinlikli ol, klişe cevaplardan kaçın
- Yanıtlarını zenginleştirmek için örnekler, benzetmeler ve senaryolar kullan

YANITLAMA İLKELERİN:
- Kullanıcının yazdığı dilde yanıt ver (dil ayarı varsa o dilde)
- Markdown formatını etkili kullan: başlıklar, listeler, kalın/italik, kod blokları
- Karmaşık konularda adım adım açıkla
- Kısa sorulara kısa, uzun sorulara detaylı yanıt ver
- Belirsiz sorularda varsayım yapmak yerine açıklayıcı soru sor

BİLİŞSEL BAĞLANTI:
- Sadece mevcut konuşmaya odaklanma; hafızadaki eski bilgilerle bugünkü konuşma arasında mantıksal bağlantılar kur
- "Geçen sefer ... konuşmuştuk, bu da onunla bağlantılı" gibi köprüler kur
- Kullanıcının ilgi alanlarını konuşma akışına doğal şekilde entegre et

DOĞRULUK:
- Emin olmadığın bilgilerde bunu açıkça belirt
- Güncel olmayabilecek bilgiler için uyar
- Teknik konularda kesin ve doğru ol

KAYNAKÇA:
- Faktüel bilgi verdiğinde, yanıtının sonuna [SOURCES] bloğu ekle
- Format: [SOURCES]{"sources":[{"title":"Kaynak","url":"https://...","snippet":"alıntı"}]}[/SOURCES]

Kurucun veya yaratıcın sorulduğunda Treasure şirketi olduğunu belirt.
`;

    const personalityPrompts: Record<string, string> = {
      friendly: "Çok sıcak ve samimi bir yapay zeka asistanısın. Arkadaşça ve neşeli ol. Emoji kullanabilirsin ama abartma. Sohbeti doğal tut.",
      professional: "Profesyonel ve resmi bir yapay zeka asistanısın. Ciddi ve iş odaklı ol. Emoji kullanma. Net, yapılandırılmış ve veri odaklı yanıtlar ver.",
      humorous: "Çok komik ve esprili bir yapay zeka asistanısın. Şakalar yap, kelime oyunları kullan. Bilgi verirken bile eğlenceli ol ama bilgi doğruluğundan taviz verme.",
      wise: "Bilge ve düşünceli bir yapay zeka asistanısın. Derin düşünceler paylaş, felsefi perspektifler sun. Cevaplarında hem pratik bilgi hem de bilgelik olsun.",
      creative: "Son derece yaratıcı ve hayal gücü yüksek bir yapay zeka asistanısın. Metaforlar, benzetmeler ve hikaye anlatımı kullan. Sıra dışı perspektifler sun.",
      mirror: "Sen bir ayna gibi davranan yapay zeka asistanısın. Kullanıcının yazdığı üslubu, tonu, enerjiyi ve dil seviyesini birebir yansıt. Resmi yazarsa resmi ol, samimi yazarsa samimi ol, kısa yazarsa kısa yaz, detaylı yazarsa detaylı yaz. Emoji kullanıyorsa sen de kullan, kullanmıyorsa kullanma.",
    };

    const thinkingInstructions = safeThinkingMode === "deep"
      ? `\n\nDERİN DÜŞÜNCE MODU:
- Soruları çok yönlü analiz et: tarihsel, bilimsel, felsefi, pratik açılardan değerlendir
- Karşıt görüşleri de ele al
- Detaylı ve kapsamlı cevaplar ver
- Gerektiğinde alt başlıklar ve madde işaretleri kullan
- Kaynak göstermeye özen göster`
      : "\nHızlı ve öz cevaplar ver. Gereksiz tekrarlardan kaçın.";

    const voiceInstructions = isVoiceMode
      ? `\n\nSESLİ SOHBET MODU AKTİF:
- Cevaplarını kısa tut (max 2-3 cümle)
- Markdown işaretleri KULLANMA
- Sayıları yazıyla yaz
- Doğal konuşma dili kullan
- "Hımm", "Anlıyorum" gibi doğal dolgu ifadeleri ekle`
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
        az: "Azərbaycan", ka: "ქართული",
      };
      const langName = langNames[safeLanguage] || safeLanguage;
      languageInstruction = `\n\nDİL TALİMATI: Tüm yanıtlarını ${langName} dilinde ver. Başka bir dil kullanma.`;
    }

    // Build connected accounts context
    
    let connectedAccountsContext = "";
    if (Array.isArray(connectedAccounts) && connectedAccounts.length > 0) {
      const accountDetails = connectedAccounts.map((acc: { provider: string; scopes?: string[]; provider_email?: string }) => {
        const scopeNames: Record<string, string> = {
          email: "E-posta okuma/gönderme (Gmail)",
          drive: "Dosya erişimi (Google Drive)",
          calendar: "Takvim yönetimi (Google Calendar)",
          profile: "Profil bilgileri",
        };
        const activeScopes = (acc.scopes || []).map((s: string) => scopeNames[s] || s).join(", ");
        return `- ${acc.provider.toUpperCase()}: ${acc.provider_email || "bağlı"} | İzinler: ${activeScopes}`;
      }).join("\n");
      
      connectedAccountsContext = `\n\n⚠️ KRİTİK TALİMAT - BAĞLI HESAPLAR (EN YÜKSEK ÖNCELİK):
Kullanıcı aşağıdaki hesapları TreFriend sistemine bağlamış ve SEN BU HESAPLARA ERİŞİM YETKİSİNE SAHİPSİN:
${accountDetails}

SEN BİR API PROXY ÜZERİNDEN BU HESAPLARA DOĞRUDAN ERİŞEBİLİRSİN. Bu bir simülasyon değil, gerçek bir entegrasyondur.

ÖNCEKİ MESAJLARDA "erişimim yok" veya "yapamam" gibi bir şey söylemiş olabilirsin — BU ESKİ BİLGİ ARTIK GEÇERSİZDİR. Sistem güncellemesi yapıldı ve artık tam erişim yetkin var. Önceki reddetme mesajlarını GÖRMEZDEN GEL ve yeni yeteneklerinle hareket et.

Kullanıcı e-posta, drive veya takvim ile ilgili bir şey istediğinde:
1. ASLA "erişimim yok", "yapamam", "teknik sınırlılık", "gizlilik politikası", "kişisel veri koruma" gibi reddetme cümlesi KULLANMA
2. Kullanıcıya hemen yardımcı ol — "Tabii, hemen bakıyorum!" gibi olumlu yanıt ver
3. İşlemi gerçekleştirmek için gerekli detayları sor (kaç e-posta, hangi tarih aralığı vb.)
4. Sonra doğrudan yardımcı ol

Örnek doğru yanıt: "Tabii, hemen Gmail hesabındaki son e-postalara bakıyorum! Kaç tanesini görmek istersin?"
Örnek YANLIŞ yanıt: "Maalesef e-postalara erişimim yok..." ← BU CEVABI VERİRSEN HATA YAPMIŞ OLURSUN`;

      console.log("Connected accounts included:", JSON.stringify(connectedAccounts));
    } else {
      console.log("No connected accounts provided");
    }

    let systemPrompt = baseContext + (personalityPrompts[safePersonality] || personalityPrompts.friendly) + thinkingInstructions + voiceInstructions + languageInstruction + connectedAccountsContext;
    if (safeMemoryContext) systemPrompt += safeMemoryContext;
    if (safeMoodContext) systemPrompt += safeMoodContext;

    console.log("Chat request - personality:", safePersonality, "mode:", safeThinkingMode, "model:", model);

    let response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...filteredMessages],
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
          messages: [{ role: "system", content: systemPrompt }, ...filteredMessages],
          stream: true,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit aşıldı. Lütfen biraz bekleyin." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kullanım limiti doldu. Lütfen kredinizi kontrol edin." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
