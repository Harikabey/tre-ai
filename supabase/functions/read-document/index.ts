import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function analyzeWithAI(fileUrl: string, fileName: string, fileType: string, mimeType: string): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!OPENROUTER_API_KEY && !LOVABLE_API_KEY) throw new Error("API key not configured");

  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) throw new Error(`Dosya indirilemedi (HTTP ${fileResponse.status})`);
  const bytes = new Uint8Array(await fileResponse.arrayBuffer());
  const base64 = encode(bytes.buffer);
  const dataMimeType = mimeType || "application/octet-stream";
  const imageUrl = `data:${dataMimeType};base64,${base64}`;

  const promptMap: Record<string, string> = {
    image: "Bu görseli detaylı olarak analiz et. Türkçe yanıt ver.",
    spreadsheet: `Bu ${fileName} dosyasını analiz et. Tablo verilerini, sütun başlıklarını ve içerikleri oku. Verileri düzenli bir şekilde özetle. Türkçe yanıt ver.`,
    presentation: `Bu ${fileName} sunum dosyasını analiz et. Slaytları, başlıkları ve içerikleri oku ve özetle. Türkçe yanıt ver.`,
    document: `Bu ${fileName} dosyasını analiz et. İçeriği oku ve özetle. Türkçe yanıt ver.`,
  };

  const prompt = promptMap[fileType] || promptMap.document;

  const requestBody = JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    }],
  });

  let response: Response | null = null;

  if (OPENROUTER_API_KEY) {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: requestBody.replace(/"model":"([^"]+)"/, '"model":"$1:free"'),
    });
    if (!response.ok) {
      console.error("OpenRouter doc error:", response.status, "- falling back");
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

  if (!response || !response.ok) throw new Error("AI analizi başarısız oldu");

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "İçerik analiz edilemedi.";
}

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input Validation ---
    const { fileUrl, fileName, mimeType } = await req.json();
    if (!fileUrl || typeof fileUrl !== "string" || fileUrl.length > 2000) {
      return new Response(JSON.stringify({ error: "Valid fileUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!fileUrl.startsWith("https://") && !fileUrl.startsWith("http://")) {
      return new Response(JSON.stringify({ error: "Invalid fileUrl scheme" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF protection: only allow Supabase Storage URLs
    try {
      const parsed = new URL(fileUrl);
      const supaHost = new URL(Deno.env.get("SUPABASE_URL") ?? "https://x").hostname;
      const host = parsed.hostname.toLowerCase();
      const isSupabase =
        host === supaHost ||
        host.endsWith(".supabase.co") ||
        host.endsWith(".supabase.in");
      if (!isSupabase) {
        return new Response(JSON.stringify({ error: "Unauthorized URL host" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid fileUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeFileName = typeof fileName === "string" ? fileName.slice(0, 255) : "unknown";
    const safeMimeType = typeof mimeType === "string" ? mimeType.slice(0, 100) : "";

    console.log("Reading document:", safeFileName);

    const response = await fetch(fileUrl, { method: "HEAD" });
    const type = safeMimeType || response.headers.get("content-type") || "";

    let textContent = "";

    // --- Text-based files ---
    if (type.includes("text/plain") || safeFileName.match(/\.(txt|log|ini|cfg|conf|env|gitignore)$/i)) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("application/json") || safeFileName.endsWith(".json")) {
      const json = await (await fetch(fileUrl)).json();
      textContent = JSON.stringify(json, null, 2);
    } else if (type.includes("text/csv") || safeFileName.endsWith(".csv")) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("text/markdown") || safeFileName.match(/\.(md|mdx)$/i)) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("text/html") || safeFileName.match(/\.(html|htm)$/i)) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("text/css") || safeFileName.endsWith(".css")) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("text/xml") || type.includes("application/xml") || safeFileName.match(/\.(xml|svg|xsl|xslt)$/i)) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("application/x-yaml") || type.includes("text/yaml") || safeFileName.match(/\.(yaml|yml)$/i)) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("application/toml") || safeFileName.endsWith(".toml")) {
      textContent = await (await fetch(fileUrl)).text();
    }
    // --- Code files ---
    else if (safeFileName.match(/\.(js|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|cpp|h|hpp|cs|php|r|scala|dart|lua|sh|bash|zsh|fish|ps1|bat|cmd|sql|graphql|gql|vue|svelte|astro|prisma|proto|tf|hcl|dockerfile|makefile|cmake|gradle|groovy|perl|pl|ex|exs|erl|hrl|hs|ml|mli|clj|cljs|elm|nim|zig|v|d|f|f90|pas|vb|vbs|asm|s|lisp|scm|rkt|tcl|awk|sed)$/i)) {
      textContent = await (await fetch(fileUrl)).text();
    }
    // --- PDF ---
    else if (type.includes("application/pdf") || safeFileName.endsWith(".pdf")) {
      textContent = await analyzeWithAI(fileUrl, safeFileName, "document", "application/pdf");
    }
    // --- Images ---
    else if (type.includes("image/") || safeFileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|tif|ico|avif|heic|heif)$/i)) {
      textContent = await analyzeWithAI(fileUrl, safeFileName, "image", type || "image/png");
    }
    // --- Spreadsheets (xlsx, xls, ods) ---
    else if (type.includes("spreadsheetml") || type.includes("ms-excel") || type.includes("opendocument.spreadsheet") || safeFileName.match(/\.(xlsx|xls|ods)$/i)) {
      const spreadsheetMime = safeFileName.endsWith(".xlsx") 
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : safeFileName.endsWith(".ods")
        ? "application/vnd.oasis.opendocument.spreadsheet"
        : "application/vnd.ms-excel";
      textContent = await analyzeWithAI(fileUrl, safeFileName, "spreadsheet", spreadsheetMime);
    }
    // --- Presentations (pptx, ppt, odp) ---
    else if (type.includes("presentationml") || type.includes("ms-powerpoint") || type.includes("opendocument.presentation") || safeFileName.match(/\.(pptx|ppt|odp)$/i)) {
      const presMime = safeFileName.endsWith(".pptx")
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : safeFileName.endsWith(".odp")
        ? "application/vnd.oasis.opendocument.presentation"
        : "application/vnd.ms-powerpoint";
      textContent = await analyzeWithAI(fileUrl, safeFileName, "presentation", presMime);
    }
    // --- Word documents (docx, doc, odt) ---
    else if (type.includes("wordprocessingml") || type.includes("msword") || type.includes("opendocument.text") || safeFileName.match(/\.(docx|doc|odt|rtf)$/i)) {
      const docMime = safeFileName.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : safeFileName.endsWith(".odt")
        ? "application/vnd.oasis.opendocument.text"
        : safeFileName.endsWith(".rtf")
        ? "application/rtf"
        : "application/msword";
      textContent = await analyzeWithAI(fileUrl, safeFileName, "document", docMime);
    }
    // --- Archive files ---
    else if (safeFileName.match(/\.(zip|rar|7z|tar|gz|bz2|xz)$/i)) {
      textContent = `[Arşiv Dosyası: ${safeFileName}]\n\nBu bir arşiv dosyasıdır. İçeriği doğrudan okunamaz, önce çıkarılması gerekir.`;
    }
    // --- Audio files ---
    else if (type.includes("audio/") || safeFileName.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma|opus)$/i)) {
      textContent = `[Ses Dosyası: ${safeFileName}]\n\nBu bir ses dosyasıdır. Ses analizi şu anda desteklenmektedir ancak transkripsiyon yapılamıyor.`;
    }
    // --- Video files ---
    else if (type.includes("video/") || safeFileName.match(/\.(mp4|mov|avi|webm|mkv|flv|wmv)$/i)) {
      textContent = `[Video Dosyası: ${safeFileName}]\n\nBu bir video dosyasıdır. Video analizi için lütfen ekran görüntüsü veya kare çıkarma özelliğini kullanın.`;
    }
    // --- Fallback: try reading as text ---
    else {
      try {
        const rawText = await (await fetch(fileUrl)).text();
        if (rawText.trim() && rawText.length > 0) {
          // Check if content looks like binary
          const binaryChars = rawText.substring(0, 500).split('').filter(c => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\r' && c !== '\t').length;
          if (binaryChars > 10) {
            // Likely binary - try AI analysis
            textContent = await analyzeWithAI(fileUrl, safeFileName, "document", type || "application/octet-stream");
          } else {
            textContent = rawText;
          }
        } else {
          textContent = `[Dosya: ${safeFileName}]\n\nBu dosya türü desteklenmiyor veya dosya boş.`;
        }
      } catch {
        textContent = `[Dosya: ${safeFileName}]\n\nBu dosya türü okunamadı.`;
      }
    }

    const maxLength = 15000;
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength) + "\n\n...[İçerik kesildi]";
    }

    return new Response(
      JSON.stringify({ content: textContent, fileName: safeFileName, mimeType: type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Document reading error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
