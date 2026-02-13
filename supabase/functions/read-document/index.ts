import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function analyzeWithAI(fileUrl: string, fileName: string, fileType: string, mimeType: string): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
  const apiUrl = OPENROUTER_API_KEY 
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";

  if (!apiKey) {
    throw new Error("API key not configured");
  }

  // For non-image files (like PDF), we need to convert to a base64 data URL
  let imageUrl = fileUrl;

  const isPdf = mimeType?.includes("pdf") || fileName?.toLowerCase().endsWith(".pdf");
  const isImage = mimeType?.includes("image/") || !!fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  if (isPdf || !isImage) {
    try {
      console.log("Converting file to base64 for AI analysis", { fileName, mimeType });
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        const t = await fileResponse.text().catch(() => "");
        throw new Error(`Dosya indirilemedi (HTTP ${fileResponse.status}): ${t.slice(0, 500)}`);
      }

      const bytes = new Uint8Array(await fileResponse.arrayBuffer());
      const base64 = encode(bytes.buffer);

      const dataMimeType = isPdf ? "application/pdf" : (mimeType || "application/octet-stream");
      imageUrl = `data:${dataMimeType};base64,${base64}`;
    } catch (e) {
      console.error("Base64 conversion failed", e);
      throw e;
    }
  }

  const prompt = fileType === "image"
    ? "Bu görseli detaylı olarak analiz et. İçindeki tüm metinleri, grafikleri, tabloları ve görsel öğeleri açıkla. Türkçe yanıt ver."
    : `Bu ${fileName} dosyasını analiz et. İçindeki tüm metinleri oku ve özetle. Tablolar, grafikler veya önemli bilgiler varsa detaylı belirt. Türkçe yanıt ver.`;

  console.log("Sending to AI for analysis", { fileType, isPdf, mimeType });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("AI analysis error:", response.status, errorText);
    throw new Error("AI analizi başarısız oldu: " + (errorText || `HTTP ${response.status}`));
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "İçerik analiz edilemedi.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileName, mimeType } = await req.json();

    if (!fileUrl) {
      throw new Error("File URL is required");
    }

    console.log("Reading document:", fileName, "from:", fileUrl);

    // Fetch the file to check content type
    const response = await fetch(fileUrl, { method: 'HEAD' });
    const type = mimeType || response.headers.get("content-type") || "";

    let textContent = "";

    // Handle different file types
    if (type.includes("text/plain") || fileName?.endsWith(".txt")) {
      const textResponse = await fetch(fileUrl);
      textContent = await textResponse.text();
    } else if (type.includes("application/json") || fileName?.endsWith(".json")) {
      const jsonResponse = await fetch(fileUrl);
      const json = await jsonResponse.json();
      textContent = JSON.stringify(json, null, 2);
    } else if (type.includes("text/csv") || fileName?.endsWith(".csv")) {
      const csvResponse = await fetch(fileUrl);
      textContent = await csvResponse.text();
    } else if (type.includes("text/markdown") || fileName?.endsWith(".md")) {
      const mdResponse = await fetch(fileUrl);
      textContent = await mdResponse.text();
    } else if (type.includes("application/pdf") || fileName?.endsWith(".pdf")) {
      // Use AI to analyze PDF (via image/document analysis)
      console.log("Analyzing PDF with AI:", fileName);
      textContent = await analyzeWithAI(fileUrl, fileName, 'document', type);
    } else if (type.includes("image/") || fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
      // Use AI to analyze images
      console.log("Analyzing image with AI:", fileName);
      textContent = await analyzeWithAI(fileUrl, fileName, 'image', type);
    } else if (type.includes("application/msword") || type.includes("application/vnd.openxmlformats-officedocument") || 
               fileName?.endsWith(".doc") || fileName?.endsWith(".docx")) {
      textContent = `[Word Dosyası: ${fileName}]\n\nWord dosyaları şu anda desteklenmiyor. Lütfen PDF veya TXT formatında yükleyin.`;
    } else {
      // Try to read as text for unknown types
      try {
        const unknownResponse = await fetch(fileUrl);
        textContent = await unknownResponse.text();
        if (textContent.length === 0 || !textContent.trim()) {
          textContent = `[Dosya: ${fileName}]\n\nBu dosya türü desteklenmiyor veya içerik okunamadı.`;
        }
      } catch {
        textContent = `[Dosya: ${fileName}]\n\nBu dosya türü desteklenmiyor.`;
      }
    }

    // Truncate if too long
    const maxLength = 15000;
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength) + "\n\n...[İçerik kesildi - çok uzun]";
    }

    return new Response(
      JSON.stringify({ content: textContent, fileName, mimeType: type }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Document reading error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
