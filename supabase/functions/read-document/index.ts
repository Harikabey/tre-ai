import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Fetch the file content
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    let textContent = "";
    const type = mimeType || response.headers.get("content-type") || "";

    // Handle different file types
    if (type.includes("text/plain") || fileName?.endsWith(".txt")) {
      textContent = await response.text();
    } else if (type.includes("application/json") || fileName?.endsWith(".json")) {
      const json = await response.json();
      textContent = JSON.stringify(json, null, 2);
    } else if (type.includes("text/csv") || fileName?.endsWith(".csv")) {
      textContent = await response.text();
    } else if (type.includes("text/markdown") || fileName?.endsWith(".md")) {
      textContent = await response.text();
    } else if (type.includes("application/pdf") || fileName?.endsWith(".pdf")) {
      // For PDF, we return a description since we can't parse it without external library
      textContent = `[PDF Dosyası: ${fileName}]\n\nBu bir PDF dosyasıdır. PDF içeriği şu anda okunamıyor. Lütfen metin tabanlı bir dosya (TXT, JSON, CSV, MD) yükleyin.`;
    } else if (type.includes("image/")) {
      // For images, describe what was uploaded
      textContent = `[Resim Dosyası: ${fileName}]\n\nBu bir resim dosyasıdır. Görüntü analizi için lütfen resmi açıklayın.`;
    } else if (type.includes("application/msword") || type.includes("application/vnd.openxmlformats-officedocument") || 
               fileName?.endsWith(".doc") || fileName?.endsWith(".docx")) {
      textContent = `[Word Dosyası: ${fileName}]\n\nBu bir Word belgesidir. Word dosyaları şu anda okunamıyor. Lütfen TXT formatında kaydedin.`;
    } else {
      // Try to read as text for unknown types
      try {
        textContent = await response.text();
        if (textContent.length === 0 || !textContent.trim()) {
          textContent = `[Dosya: ${fileName}]\n\nBu dosya türü desteklenmiyor veya içerik okunamadı.`;
        }
      } catch {
        textContent = `[Dosya: ${fileName}]\n\nBu dosya türü desteklenmiyor.`;
      }
    }

    // Truncate if too long
    const maxLength = 10000;
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
