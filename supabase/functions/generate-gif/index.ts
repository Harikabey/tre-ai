import { callAiWithFallback } from "../_shared/aiFallback.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
    const { prompt, frameCount = 4 } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 2000) {
      return new Response(JSON.stringify({ error: "Valid prompt required (max 2000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const numFrames = Math.min(Math.max(Number(frameCount) || 4, 2), 6);

    // --- API Setup ---
    console.log(`Generating ${numFrames} frames for GIF with prompt:`, prompt);

    const extractImageUrl = (data: any): string | null => {
      // Check images array
      const images = data.choices?.[0]?.message?.images;
      if (images && images.length > 0) {
        const img = images[0];
        if (typeof img === "string") return img;
        if (img?.image_url?.url) return img.image_url.url;
        if (img?.url) return img.url;
      }
      // Check inline_data in parts (Gemini native format)
      const parts = data.choices?.[0]?.message?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.inline_data?.data) {
            return `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
          }
        }
      }
      // Check content for base64 data URI
      const textContent = data.choices?.[0]?.message?.content || "";
      if (typeof textContent === "string") {
        const base64Match = textContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (base64Match) return base64Match[0];
      }
      // Check if content is an array of parts (OpenAI multimodal format)
      if (Array.isArray(textContent)) {
        for (const part of textContent) {
          if (part.type === "image_url" && part.image_url?.url) return part.image_url.url;
        }
      }
      return null;
    };

    const generateFrame = async (framePrompt: string, referenceImageUrl?: string): Promise<string | null> => {
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

      const requestBody = JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages,
        modalities: ["image", "text"],
      });

      const hasImage = async (response: Response): Promise<boolean> => {
        const data = await response.json();
        return Boolean(extractImageUrl(data));
      };
      const response = await callAiWithFallback(requestBody, {
        operation: "GIF frame generation",
        openRouterKind: "vision",
        isUsable: hasImage,
      });
      if (!response?.ok) return null;

      const data = await response.json();
      const imageUrl = extractImageUrl(data);
      if (imageUrl) return imageUrl;
      return null;
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

    if (imageUrls.length < 2) throw new Error("Yeterli kare oluşturulamadı. Lütfen tekrar deneyin.");

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
