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
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("API key is not configured");
    }

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating video with prompt:", prompt);

    // Use Veo 2 model for video generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/video/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/veo-2.0-generate-001",
        prompt: `Create a high-quality video: ${prompt}. Make it visually engaging and smooth.`,
        duration: 5,
        aspect_ratio: "16:9",
        resolution: "1080p",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Video oluşturulamadı: " + errorText);
    }

    const data = await response.json();
    console.log("Video generation response:", JSON.stringify(data, null, 2));

    // Extract video URL from response
    let videoUrl = null;
    
    if (data.data && data.data.length > 0) {
      videoUrl = data.data[0]?.url || data.data[0]?.video_url;
    } else if (data.video_url) {
      videoUrl = data.video_url;
    } else if (data.url) {
      videoUrl = data.url;
    }

    if (!videoUrl) {
      console.error("No video found in response. Full data:", JSON.stringify(data));
      throw new Error("Video oluşturulamadı - model video üretemedi. Lütfen farklı bir açıklama deneyin.");
    }

    return new Response(
      JSON.stringify({ videoUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate video error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
