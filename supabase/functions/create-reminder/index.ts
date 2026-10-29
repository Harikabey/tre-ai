import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-mode",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Auth required" }, 401);
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const text = (body.text || "").toString().slice(0, 2000);
    const rawTz = (body.timezone || "UTC").toString().slice(0, 64);
    let timezone = "UTC";
    try { if (/^[A-Za-z0-9_+\-\/]+$/.test(rawTz)) { new Intl.DateTimeFormat("en-US", { timeZone: rawTz }); timezone = rawTz; } } catch { timezone = "UTC"; }
    const conversationId = body.conversationId || null;
    if (!text) return json({ error: "text required" }, 400);

    // Ask AI to extract structured reminder info.
    const nowIso = new Date().toISOString();
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!groqApiKey && !openRouterApiKey) return json({ error: "AI not configured" }, 500);

    const messages = [
      {
        role: "system",
        content: `You extract reminder info from user text. Current time (ISO): ${nowIso}. User timezone: ${timezone}. Interpret relative times ("in 10 min", "yarın 9'da", "pazartesi 15:00") relative to that timezone. Reply STRICTLY as JSON: {"title": string, "body": string, "remind_at": ISO8601 string in UTC}. Title short (max 60 chars). Body optional details. If no clear time, pick a sensible default (e.g. in 1 hour) but keep it in the future.`,
      },
      { role: "user", content: text },
    ];
    let aiRes: Response | null = null;

    if (groqApiKey) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            response_format: { type: "json_object" },
          }),
        });
        if (response.ok) {
          aiRes = response;
        } else {
          console.error("Groq AI error", response.status, (await response.text()).slice(0, 300));
        }
      } catch (e) {
        console.error("Groq AI request failed", e);
      }
    }

    if (!aiRes && openRouterApiKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3.5-lightning:free",
            messages,
            response_format: { type: "json_object" },
          }),
        });
        if (response.ok) {
          aiRes = response;
        } else {
          console.error("OpenRouter AI error", response.status, (await response.text()).slice(0, 300));
        }
      } catch (e) {
        console.error("OpenRouter AI request failed", e);
      }
    }
    if (!aiRes) return json({ error: "AI failed" }, 500);

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const title = (parsed.title || "Hatırlatıcı").toString().slice(0, 100);
    const bodyText = (parsed.body || "").toString().slice(0, 500);
    let remindAt = parsed.remind_at ? new Date(parsed.remind_at) : null;
    if (!remindAt || isNaN(remindAt.getTime())) {
      remindAt = new Date(Date.now() + 60 * 60 * 1000);
    }
    if (remindAt.getTime() < Date.now() + 10_000) {
      remindAt = new Date(Date.now() + 60 * 1000);
    }

    const { data, error } = await admin
      .from("reminders")
      .insert({
        user_id: user.id,
        title,
        body: bodyText || null,
        remind_at: remindAt.toISOString(),
        timezone,
        conversation_id: conversationId,
      })
      .select("id, title, body, remind_at")
      .single();

    if (error) {
      console.error(error);
      return json({ error: "insert failed" }, 500);
    }

    return json({ ok: true, reminder: data });
  } catch (e) {
    console.error(e);
    return json({ error: "Server error" }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
