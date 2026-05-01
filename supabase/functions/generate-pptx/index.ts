// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import PptxGenJS from "https://esm.sh/pptxgenjs@3.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-voice-mode",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

interface SlideSpec {
  title: string;
  bullets?: string[];
  body?: string;
  layout?: "title" | "content" | "twoColumn" | "section" | "closing";
}

interface DeckSpec {
  title: string;
  subtitle?: string;
  theme: {
    bg: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    headerFont: string;
    bodyFont: string;
  };
  slides: SlideSpec[];
}

const FALLBACK_THEMES = [
  { bg: "0B0F19", primary: "00E0D6", secondary: "1E2A3D", accent: "FFD166", text: "F5F7FA", headerFont: "Calibri", bodyFont: "Calibri" },
  { bg: "FFFFFF", primary: "1E2761", secondary: "CADCFC", accent: "F96167", text: "212121", headerFont: "Georgia", bodyFont: "Calibri" },
  { bg: "F5F2EC", primary: "B85042", secondary: "A7BEAE", accent: "2C5F2D", text: "2B2B2B", headerFont: "Palatino", bodyFont: "Calibri" },
  { bg: "0E1B2C", primary: "00A896", secondary: "065A82", accent: "F2F2F2", text: "EAF2F8", headerFont: "Trebuchet MS", bodyFont: "Calibri" },
];

async function generateDeckSpec(prompt: string): Promise<DeckSpec> {
  const sys = `Sen profesyonel sunum tasarımcısısın. Kullanıcının konusuna göre 6-10 slayttan oluşan PowerPoint sunum yapısı üret.
Konuyu analiz et ve uygun bir renk paleti + font eşleşmesi seç.
SADECE şu JSON formatında yanıt ver, başka metin yazma:
{
  "title": "Sunum başlığı",
  "subtitle": "Alt başlık (opsiyonel)",
  "theme": {
    "bg": "RRGGBB (arkaplan)",
    "primary": "RRGGBB (ana renk)",
    "secondary": "RRGGBB (ikincil)",
    "accent": "RRGGBB (vurgu)",
    "text": "RRGGBB (metin)",
    "headerFont": "Calibri|Georgia|Arial|Trebuchet MS|Palatino|Cambria",
    "bodyFont": "Calibri|Arial"
  },
  "slides": [
    {"layout": "title", "title": "...", "body": "alt başlık"},
    {"layout": "content", "title": "...", "bullets": ["...", "..."]},
    {"layout": "section", "title": "Bölüm adı"},
    {"layout": "twoColumn", "title": "...", "bullets": ["sol1","sol2","|","sağ1","sağ2"]},
    {"layout": "closing", "title": "Teşekkürler", "body": "kapanış mesajı"}
  ]
}
Renkler konuyla uyumlu olsun (finans=mavi/yeşil, sağlık=teal, teknoloji=koyu+neon, eğitim=sıcak vb).
Bullet sayısı slayt başına 3-6 arası, her bullet en fazla 12 kelime.
İçerik Türkçe olsun (kullanıcı başka dil belirtmediyse).`;

  const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
  const apiUrl = LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const model = LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.error("AI deck spec error:", res.status, await res.text());
    return defaultDeck(prompt);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    if (!parsed.theme) parsed.theme = FALLBACK_THEMES[Math.floor(Math.random() * FALLBACK_THEMES.length)];
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return defaultDeck(prompt);
    }
    return parsed as DeckSpec;
  } catch {
    return defaultDeck(prompt);
  }
}

function defaultDeck(prompt: string): DeckSpec {
  const theme = FALLBACK_THEMES[0];
  return {
    title: prompt.slice(0, 60),
    subtitle: "Otomatik oluşturulmuş sunum",
    theme,
    slides: [
      { layout: "title", title: prompt.slice(0, 60), body: "Otomatik sunum" },
      { layout: "content", title: "Genel Bakış", bullets: ["Konu tanıtımı", "Ana noktalar", "Sonuç"] },
      { layout: "closing", title: "Teşekkürler", body: "Sorular?" },
    ],
  };
}

function buildPptx(deck: DeckSpec): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pptx.title = deck.title;
  const t = deck.theme;
  const W = 13.333;
  const H = 7.5;

  for (const s of deck.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: t.bg };

    // Accent bar
    slide.addShape("rect", { x: 0, y: 0, w: 0.25, h: H, fill: { color: t.primary }, line: { color: t.primary } });

    if (s.layout === "title" || s.layout === "closing") {
      slide.addShape("rect", { x: 0, y: 0, w: W, h: H, fill: { color: t.bg }, line: { color: t.bg } });
      slide.addShape("rect", { x: 0, y: H - 0.6, w: W, h: 0.6, fill: { color: t.primary }, line: { color: t.primary } });
      slide.addText(s.title || deck.title, {
        x: 0.8, y: 2.2, w: W - 1.6, h: 2.0,
        fontSize: 54, bold: true, color: t.text, fontFace: t.headerFont, align: "left", valign: "middle",
      });
      if (s.body || deck.subtitle) {
        slide.addText(s.body || deck.subtitle || "", {
          x: 0.8, y: 4.4, w: W - 1.6, h: 1.0,
          fontSize: 22, color: t.primary, fontFace: t.bodyFont, align: "left",
        });
      }
    } else if (s.layout === "section") {
      slide.addShape("rect", { x: 0, y: H / 2 - 1.2, w: W, h: 2.4, fill: { color: t.secondary }, line: { color: t.secondary } });
      slide.addText(s.title, {
        x: 0.5, y: H / 2 - 1.2, w: W - 1, h: 2.4,
        fontSize: 48, bold: true, color: t.text, fontFace: t.headerFont, align: "center", valign: "middle",
      });
    } else if (s.layout === "twoColumn" && s.bullets) {
      slide.addText(s.title, {
        x: 0.6, y: 0.4, w: W - 1.2, h: 0.9,
        fontSize: 32, bold: true, color: t.primary, fontFace: t.headerFont,
      });
      const sepIdx = s.bullets.indexOf("|");
      const left = sepIdx >= 0 ? s.bullets.slice(0, sepIdx) : s.bullets.slice(0, Math.ceil(s.bullets.length / 2));
      const right = sepIdx >= 0 ? s.bullets.slice(sepIdx + 1) : s.bullets.slice(Math.ceil(s.bullets.length / 2));
      slide.addText(left.map((b) => ({ text: b, options: { bullet: { code: "25CF" } } })), {
        x: 0.6, y: 1.6, w: (W - 1.5) / 2, h: H - 2.2,
        fontSize: 18, color: t.text, fontFace: t.bodyFont, valign: "top", paraSpaceAfter: 8,
      });
      slide.addText(right.map((b) => ({ text: b, options: { bullet: { code: "25CF" } } })), {
        x: 0.6 + (W - 1.5) / 2 + 0.3, y: 1.6, w: (W - 1.5) / 2, h: H - 2.2,
        fontSize: 18, color: t.text, fontFace: t.bodyFont, valign: "top", paraSpaceAfter: 8,
      });
    } else {
      // content
      slide.addText(s.title, {
        x: 0.6, y: 0.4, w: W - 1.2, h: 0.9,
        fontSize: 32, bold: true, color: t.primary, fontFace: t.headerFont,
      });
      slide.addShape("rect", { x: 0.6, y: 1.3, w: 1.2, h: 0.06, fill: { color: t.accent }, line: { color: t.accent } });
      if (s.bullets && s.bullets.length) {
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" } } })),
          { x: 0.6, y: 1.7, w: W - 1.2, h: H - 2.3, fontSize: 20, color: t.text, fontFace: t.bodyFont, valign: "top", paraSpaceAfter: 10 }
        );
      } else if (s.body) {
        slide.addText(s.body, { x: 0.6, y: 1.7, w: W - 1.2, h: H - 2.3, fontSize: 20, color: t.text, fontFace: t.bodyFont, valign: "top" });
      }
    }

    // Footer
    slide.addText(deck.title, {
      x: 0.5, y: H - 0.35, w: W - 1, h: 0.3,
      fontSize: 9, color: t.secondary, fontFace: t.bodyFont, align: "right",
    });
  }

  return pptx.write({ outputType: "arraybuffer" }) as Promise<ArrayBuffer>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Yetkisiz erişim" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Geçersiz oturum" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const prompt = String(body.prompt || "").slice(0, 3000).trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Konu belirtilmedi" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("PPTX request from", userId, "prompt len:", prompt.length);

    const deck = await generateDeckSpec(prompt);
    const buffer = await buildPptx(deck);

    const safeName = (deck.title || "sunum")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .slice(0, 50)
      .replace(/\s+/g, "-") || "sunum";
    const fileName = `${safeName}-${Date.now()}.pptx`;
    const path = `${userId}/${fileName}`;

    const { error: upErr } = await adminClient.storage
      .from("generated-files")
      .upload(path, new Uint8Array(buffer), {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: false,
      });

    if (upErr) {
      console.error("Upload error:", upErr);
      return new Response(JSON.stringify({ error: "Yükleme başarısız" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = adminClient.storage.from("generated-files").getPublicUrl(path);

    return new Response(
      JSON.stringify({
        url: pub.publicUrl,
        fileName,
        title: deck.title,
        slideCount: deck.slides.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-pptx error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Beklenmeyen hata" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
