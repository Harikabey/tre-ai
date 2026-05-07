import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-voice-mode",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input ---
    const body = await req.json();
    const mode: "tts" | "music" = body.mode === "music" ? "music" : "tts";
    const text: string = typeof body.text === "string" ? body.text : "";
    const duration: number = Math.min(Math.max(Number(body.duration) || 20, 5), 60);
    const voiceIdRaw: string = typeof body.voiceId === "string" ? body.voiceId : "";
    const voiceId = /^[a-zA-Z0-9]{1,50}$/.test(voiceIdRaw) ? voiceIdRaw : "EXAVITQu4vr4xnSDxMaL";

    if (!text || text.length < 1 || text.length > 5000) {
      return new Response(JSON.stringify({ error: "Geçerli metin/prompt gerekli (1-5000 char)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    let response: Response;
    if (mode === "music") {
      response = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          music_length_ms: Math.round(duration * 1000),
        }),
      });
    } else {
      response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`ElevenLabs ${mode} error:`, response.status, errText.slice(0, 300));
      throw new Error(`Ses üretimi başarısız (${response.status})`);
    }

    const audioBuffer = await response.arrayBuffer();

    // Upload to generated-files (public)
    const fileName = `${mode}-${Date.now()}.mp3`;
    const path = `${user.id}/${fileName}`;
    const { error: upErr } = await adminClient.storage
      .from("generated-files")
      .upload(path, new Uint8Array(audioBuffer), {
        contentType: "audio/mpeg",
        upsert: false,
      });
    if (upErr) {
      console.error("Upload error:", upErr);
      throw new Error("Yükleme başarısız");
    }
    const { data: pub } = adminClient.storage.from("generated-files").getPublicUrl(path);

    return new Response(
      JSON.stringify({ url: pub.publicUrl, fileName, mode }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-audio error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
