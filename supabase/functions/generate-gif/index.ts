import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { prompt, frameCount = 4 } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 2000) {
      return new Response(JSON.stringify({ error: "Valid prompt required (max 2000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const numFrames = Math.min(Math.max(Number(frameCount) || 4, 2), 6);

    // --- API Setup ---
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
    const apiUrl = OPENROUTER_API_KEY
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    if (!apiKey) throw new Error("API key is not configured");

    console.log(`Generating ${numFrames} frames for GIF with prompt:`, prompt);

    const generateFrame = async (framePrompt: string, referenceImageUrl?: string): Promise<string | null> => {
      try {
        const messages: any[] = [];
        if (referenceImageUrl) {
          messages.push({
            role: "user",
            content: [
              { type: "image_url", image_url: { url: referenceImageUrl } },
              { type: "text", text: framePrompt },
            ],
          });
        } else {
          messages.push({ role: "user", content: framePrompt });
        }

        const requestBody = JSON.stringify({ model: "google/gemini-3-pro-image-preview", messages, modalities: ["image", "text"] });

        let response: Response | null = null;

        // Try OpenRouter first
        if (OPENROUTER_API_KEY) {
          response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
            body: requestBody,
          });
          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 402 || errorText.includes("payment_required") || errorText.includes("Not enough credits")) {
              throw new Error("API kredi limiti aşıldı.");
            }
            console.error("OpenRouter frame error:", response.status, "- falling back");
            response = null;
          }
        }

        // Fallback to Lovable gateway
        if (!response && LOVABLE_API_KEY) {
          response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: requestBody,
          });
        }

        if (!response || !response.ok) return null;

        const data = await response.json();
        const images = data.choices?.[0]?.message?.images;
        if (images && images.length > 0) return images[0]?.image_url?.url;
        const textContent = data.choices?.[0]?.message?.content || "";
        const base64Match = textContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        return base64Match ? base64Match[0] : null;
      } catch (err) {
        console.error("Frame fetch error:", err);
        return null;
      }
    };

    const imageUrls: string[] = [];

    const frame1Prompt =
      `Generate exactly ONE image, 256x256 pixels. Frame 1 of ${numFrames} for animation: "${prompt}". Starting frame. Style: clean illustration, vivid colors. No text. Always produce an image.`;

    const firstFrame = await generateFrame(frame1Prompt);
    if (firstFrame) imageUrls.push(firstFrame);

    for (let i = 1; i < numFrames; i++) {
      const progress = Math.round((i / (numFrames - 1)) * 100);
      const isLast = i === numFrames - 1;
      const framePrompt =
        `The attached image is the PREVIOUS frame of a ${numFrames}-frame animation: "${prompt}". Generate frame ${i + 1} (${progress}% through). ${isLast ? "FINAL frame." : "Show slight progression."} Keep EXACT same style. Same 256x256. No text. Always produce an image.`;

      const prevFrame = imageUrls[imageUrls.length - 1];
      const frame = await generateFrame(framePrompt, prevFrame);
      if (frame) imageUrls.push(frame);
    }

    if (imageUrls.length < 2) throw new Error("Yeterli kare oluşturulamadı.");

    return new Response(
      JSON.stringify({ frames: imageUrls, frameCount: imageUrls.length, delay: 500 }),
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
