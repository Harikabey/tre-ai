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
    const { prompt, frameCount = 4 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const numFrames = Math.min(Math.max(frameCount, 2), 6);
    console.log(`Generating ${numFrames} frames for GIF with prompt:`, prompt);

    // Build a detailed scene description for consistency
    const sceneDescription = `Scene: "${prompt}". Style: flat illustration, bold colors, clean lines, 256x256 pixels. Same character/object design in every frame. Same background, same color palette, same art style.`;
    
    // Generate multiple frames with progression prompts
    const framePrompts: string[] = [];
    const stages = [
      "beginning/starting position of the action",
      "early phase, slight movement from starting position",
      "middle of the action, halfway through the motion",
      "near the end, action almost complete",
      "final position, action completed",
      "returning to start or follow-through position"
    ];
    
    for (let i = 0; i < numFrames; i++) {
      const stage = stages[i] || stages[stages.length - 1];
      framePrompts.push(
        `Generate exactly ONE image. ${sceneDescription} ` +
        `This is frame ${i + 1} of ${numFrames} in a smooth animation loop. ` +
        `Current stage: ${stage}. ` +
        `IMPORTANT: The subject, proportions, colors, background, and art style must be IDENTICAL across all frames. ` +
        `Only the pose/position changes slightly to create smooth animation. No text overlays. Always produce an image.`
      );
    }

    // Generate frames in batches of 2
    const imageUrls: string[] = [];
    
    for (let batch = 0; batch < framePrompts.length; batch += 2) {
      const batchPrompts = framePrompts.slice(batch, batch + 2);
      const batchResults = await Promise.all(
        batchPrompts.map(async (fp) => {
          try {
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [{ role: "user", content: fp }],
                modalities: ["image", "text"],
              }),
            });

            if (!response.ok) {
              console.error("Frame generation error:", await response.text());
              return null;
            }

            const data = await response.json();
            const images = data.choices?.[0]?.message?.images;
            if (images && images.length > 0) {
              return images[0]?.image_url?.url;
            }
            
            const textContent = data.choices?.[0]?.message?.content || "";
            const base64Match = textContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
            return base64Match ? base64Match[0] : null;
          } catch (err) {
            console.error("Frame fetch error:", err);
            return null;
          }
        })
      );

      for (const url of batchResults) {
        if (url) imageUrls.push(url);
      }
    }

    if (imageUrls.length < 2) {
      throw new Error("Yeterli kare oluşturulamadı. Lütfen tekrar deneyin.");
    }

    console.log(`Generated ${imageUrls.length} frames successfully`);

    return new Response(
      JSON.stringify({ 
        frames: imageUrls,
        frameCount: imageUrls.length,
        delay: 500,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate GIF error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
