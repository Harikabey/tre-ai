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

    // Helper to generate a single frame
    const generateFrame = async (framePrompt: string, referenceImageUrl?: string): Promise<string | null> => {
      try {
        const messages: any[] = [];
        
        if (referenceImageUrl) {
          messages.push({
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: referenceImageUrl }
              },
              {
                type: "text",
                text: framePrompt
              }
            ]
          });
        } else {
          messages.push({ role: "user", content: framePrompt });
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages,
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Frame generation error:", errorText);
          // Propagate credit/auth errors immediately instead of silently returning null
          if (response.status === 402 || errorText.includes("payment_required") || errorText.includes("Not enough credits")) {
            throw new Error("API kredi limiti aşıldı. Lütfen daha sonra tekrar deneyin.");
          }
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
    };

    const imageUrls: string[] = [];

    // FRAME 1: Generate the starting frame independently
    const frame1Prompt = 
      `Generate exactly ONE image, 256x256 pixels. ` +
      `You are creating frame 1 of ${numFrames} for a short animation/video clip. ` +
      `The animation shows: "${prompt}". ` +
      `This is the STARTING frame. Show the very beginning of the action. ` +
      `Style: clean illustration, vivid colors, consistent proportions. No text. Always produce an image.`;

    console.log("Generating frame 1 (starting frame)...");
    const firstFrame = await generateFrame(frame1Prompt);
    if (firstFrame) imageUrls.push(firstFrame);

    // FRAMES 2+: Generate sequentially, each referencing the PREVIOUS frame
    for (let i = 1; i < numFrames; i++) {
      const progress = Math.round((i / (numFrames - 1)) * 100);
      const isLast = i === numFrames - 1;
      
      const framePrompt = 
        `The attached image is the PREVIOUS frame of a ${numFrames}-frame animation showing: "${prompt}". ` +
        `Generate the NEXT frame (frame ${i + 1} of ${numFrames}, ${progress}% through the action). ` +
        `${isLast ? 'This is the FINAL frame — show the action completed.' : `Show the action progressed slightly further from the previous frame.`} ` +
        `CRITICAL RULES: ` +
        `1. Keep the EXACT same character/object design, colors, background, and art style as the previous frame. ` +
        `2. Only change the position/pose to show the NEXT moment in time, like the next frame of a video. ` +
        `3. The change should be SMALL and natural — smooth motion, not a jump cut. ` +
        `4. Same 256x256 size. No text. Always produce an image.`;

      console.log(`Generating frame ${i + 1} (referencing previous frame)...`);
      const prevFrame = imageUrls[imageUrls.length - 1];
      const frame = await generateFrame(framePrompt, prevFrame);
      if (frame) imageUrls.push(frame);
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
