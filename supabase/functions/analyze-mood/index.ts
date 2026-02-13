import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MoodAnalysis {
  mood: string;
  mood_score: number; // -1 (very negative) to 1 (very positive)
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
  interests: Array<{
    interest: string;
    category: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
    const apiUrl = OPENROUTER_API_KEY 
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    if (!apiKey) {
      throw new Error("API key is not configured");
    }

    const [moodResult, memoryResult] = await Promise.all([
      analyzeMood(message, apiKey, apiUrl),
      extractMemories(message, conversationHistory, apiKey, apiUrl)
    ]);

    return new Response(JSON.stringify({
      mood: moodResult,
      memories: memoryResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analyze mood error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function analyzeMood(message: string, apiKey: string, apiUrl: string): Promise<MoodAnalysis> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Sen bir duygu analizi uzmanısın. Kullanıcının mesajını analiz et ve JSON formatında yanıt ver.

Yanıt formatı:
{
  "mood": "mutlu|üzgün|kızgın|endişeli|heyecanlı|sakin|yorgun|stresli|nötr|meraklı|umutlu|hayal_kırıklığı",
  "mood_score": -1 ile 1 arası sayı (negatif=olumsuz, pozitif=olumlu),
  "emotions": ["tespit edilen duygular listesi"],
  "suggested_tone": "AI'ın yanıt verirken kullanması gereken ton (destekleyici/neşeli/sakin/motive_edici/empatik/bilgilendirici)"
}

SADECE JSON döndür, başka açıklama ekleme.`
        },
        { role: "user", content: message }
      ],
    }),
  });

  if (!response.ok) {
    console.error("Mood analysis failed:", await response.text());
    return {
      mood: "nötr",
      mood_score: 0,
      emotions: [],
      suggested_tone: "bilgilendirici"
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  try {
    // Clean the response - remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedContent);
  } catch {
    console.error("Failed to parse mood response:", content);
    return {
      mood: "nötr",
      mood_score: 0,
      emotions: [],
      suggested_tone: "bilgilendirici"
    };
  }
}

async function extractMemories(
  message: string, 
  conversationHistory: Array<{role: string; content: string}> | undefined,
  apiKey: string,
  apiUrl: string
): Promise<MemoryExtraction> {
  const recentContext = conversationHistory?.slice(-6).map(m => 
    `${m.role === 'user' ? 'Kullanıcı' : 'AI'}: ${m.content}`
  ).join('\n') || '';

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Sen bir bilgi çıkarma uzmanısın. Kullanıcının mesajından hatırlanması gereken önemli bilgileri çıkar.

Aşağıdaki türlerde bilgi ara:
- fact: Kişisel gerçekler (isim, yaş, meslek, şehir vb.)
- preference: Tercihler (sevdiği/sevmediği şeyler)
- interest: İlgi alanları ve hobiler
- habit: Alışkanlıklar ve rutinler
- relationship: İlişkiler (aile, arkadaşlar, iş arkadaşları)
- goal: Hedefler ve hayaller

Yanıt formatı (SADECE JSON):
{
  "memories": [
    {
      "type": "fact|preference|interest|habit|relationship|goal",
      "category": "kategori (iş, aile, hobi, sağlık, eğitim vb.)",
      "content": "hatırlanacak bilgi",
      "importance": 1-10 arası önem derecesi
    }
  ],
  "interests": [
    {
      "interest": "ilgi alanı adı",
      "category": "kategori"
    }
  ]
}

Eğer hatırlanacak önemli bir bilgi yoksa boş array döndür.
SADECE gerçekten önemli ve kalıcı bilgileri çıkar, geçici durumları değil.`
        },
        { 
          role: "user", 
          content: recentContext ? `Önceki konuşma:\n${recentContext}\n\nSon mesaj: ${message}` : message 
        }
      ],
    }),
  });

  if (!response.ok) {
    console.error("Memory extraction failed:", await response.text());
    return { memories: [], interests: [] };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  try {
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedContent);
  } catch {
    console.error("Failed to parse memory response:", content);
    return { memories: [], interests: [] };
  }
}
