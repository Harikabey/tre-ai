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
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input Validation ---
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 2000) {
      return new Response(JSON.stringify({ error: "Valid prompt required (max 2000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- API Setup with fallback ---
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!OPENROUTER_API_KEY && !LOVABLE_API_KEY) throw new Error("API key is not configured");

    const requestBody = JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{
        role: "user",
        content: `Generate ONE high-quality image. Visually depict this request: ${prompt}. If the request is abstract, create a symbolic/illustrative scene. Do not refuse; always produce an image.`,
      }],
      modalities: ["image", "text"],
    });

    let response: Response | null = null;

    // Try OpenRouter first
    if (OPENROUTER_API_KEY) {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: requestBody,
      });
      if (!response.ok) {
        console.error("OpenRouter error:", response.status, "- falling back to Lovable gateway");
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

    if (!response || !response.ok) {
      console.error("AI gateway error:", response?.status);
      throw new Error("Görsel oluşturulamadı");
    }

    const data = await response.json();
    const images = data.choices?.[0]?.message?.images;
    const textResponse = data.choices?.[0]?.message?.content || "";
    let imageUrl = null;

    if (images && images.length > 0) {
      imageUrl = images[0]?.image_url?.url;
    }
    if (!imageUrl && textResponse) {
      const base64Match = textResponse.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (base64Match) imageUrl = base64Match[0];
    }

    if (!imageUrl) {
      throw new Error("Görsel oluşturulamadı - model görsel üretemedi.");
    }

    return new Response(JSON.stringify({ imageUrl, description: textResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
