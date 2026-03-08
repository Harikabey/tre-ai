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

  let imageUrl = fileUrl;
  const isPdf = mimeType?.includes("pdf") || fileName?.toLowerCase().endsWith(".pdf");
  const isImage = mimeType?.includes("image/") || !!fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  if (isPdf || !isImage) {
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error(`Dosya indirilemedi (HTTP ${fileResponse.status})`);
    const bytes = new Uint8Array(await fileResponse.arrayBuffer());
    const base64 = encode(bytes.buffer);
    const dataMimeType = isPdf ? "application/pdf" : (mimeType || "application/octet-stream");
    imageUrl = `data:${dataMimeType};base64,${base64}`;
  }

  const prompt = fileType === "image"
    ? "Bu görseli detaylı olarak analiz et. Türkçe yanıt ver."
    : `Bu ${fileName} dosyasını analiz et. İçeriği oku ve özetle. Türkçe yanıt ver.`;

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
      body: requestBody,
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !data?.claims) {
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
    const safeFileName = typeof fileName === "string" ? fileName.slice(0, 255) : "unknown";
    const safeMimeType = typeof mimeType === "string" ? mimeType.slice(0, 100) : "";

    console.log("Reading document:", safeFileName);

    const response = await fetch(fileUrl, { method: "HEAD" });
    const type = safeMimeType || response.headers.get("content-type") || "";

    let textContent = "";

    if (type.includes("text/plain") || safeFileName.endsWith(".txt")) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("application/json") || safeFileName.endsWith(".json")) {
      const json = await (await fetch(fileUrl)).json();
      textContent = JSON.stringify(json, null, 2);
    } else if (type.includes("text/csv") || safeFileName.endsWith(".csv")) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("text/markdown") || safeFileName.endsWith(".md")) {
      textContent = await (await fetch(fileUrl)).text();
    } else if (type.includes("application/pdf") || safeFileName.endsWith(".pdf")) {
      textContent = await analyzeWithAI(fileUrl, safeFileName, "document", type);
    } else if (type.includes("image/") || safeFileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
      textContent = await analyzeWithAI(fileUrl, safeFileName, "image", type);
    } else if (type.includes("application/msword") || type.includes("application/vnd.openxmlformats-officedocument") ||
      safeFileName.endsWith(".doc") || safeFileName.endsWith(".docx")) {
      textContent = `[Word Dosyası: ${safeFileName}]\n\nWord dosyaları şu anda desteklenmiyor.`;
    } else {
      try {
        textContent = await (await fetch(fileUrl)).text();
        if (!textContent.trim()) {
          textContent = `[Dosya: ${safeFileName}]\n\nBu dosya türü desteklenmiyor.`;
        }
      } catch {
        textContent = `[Dosya: ${safeFileName}]\n\nBu dosya türü desteklenmiyor.`;
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
