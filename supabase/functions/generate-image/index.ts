import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating image with prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content:
              `Generate ONE high-quality image. ` +
              `Visually depict this request: ${prompt}. ` +
              `If the request is abstract (e.g., a topic), create a symbolic/illustrative scene representing it. ` +
              `Do not refuse; always produce an image.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Görsel oluşturulamadı: " + errorText);
    }

    const data = await response.json();
    console.log("Full response structure:", JSON.stringify(data, null, 2));

    // Check for images in the response
    const images = data.choices?.[0]?.message?.images;
    const textResponse = data.choices?.[0]?.message?.content || "";

    console.log("Images array:", images);
    console.log("Text response:", textResponse);

    let imageUrl = null;

    // Try to get image from images array
    if (images && images.length > 0) {
      imageUrl = images[0]?.image_url?.url;
    }

    // If no image in images array, check if there's a base64 in the content itself
    if (!imageUrl && textResponse) {
      // Sometimes the model returns base64 directly in content
      const base64Match = textResponse.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (base64Match) {
        imageUrl = base64Match[0];
      }
    }

    if (!imageUrl) {
      console.error("No image found in response. Full data:", JSON.stringify(data));
      throw new Error("Görsel oluşturulamadı - model görsel üretemedi. Lütfen farklı bir açıklama deneyin.");
    }

    return new Response(
      JSON.stringify({ imageUrl, description: textResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
