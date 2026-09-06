import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

async function generateReply(history: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
  if (!apiKey) return "Şu an cevap üretemiyorum (API anahtarı eksik).";

  const endpoint = OPENROUTER_API_KEY
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const model = OPENROUTER_API_KEY ? "google/gemini-2.5-flash:free" : "google/gemini-2.5-flash";

  const messages = [
    {
      role: "system",
      content:
        "Sen Tre'sin — sıcak, samimi, Türkçe konuşan bir AI asistanı. Bildirim üzerinden konuşuyorsun, cevabını kısa tut (max 2-3 cümle).",
    },
    ...history.slice(-10).map((m) => ({
      role: m.role === "bot" ? "assistant" : m.role,
      content: m.content.slice(0, 4000),
    })),
  ];

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("AI error", res.status, t.slice(0, 300));
    return "Cevap üretilirken bir sorun oldu.";
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.toString().trim() || "...";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userMessage = (body.message || "").toString().trim();
    let conversationId: string | null = body.conversationId || null;
    if (!userMessage || userMessage.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create conversation
    if (conversationId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!conv) conversationId = null;
    }
    if (!conversationId) {
      // Use most recent conversation or create new
      const { data: recent } = await admin
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) {
        conversationId = recent.id;
      } else {
        const { data: created, error: cErr } = await admin
          .from("conversations")
          .insert({ user_id: user.id, title: userMessage.slice(0, 40) })
          .select("id")
          .single();
        if (cErr || !created) {
          return new Response(JSON.stringify({ error: cErr?.message || "conv create failed" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        conversationId = created.id;
      }
    }

    // Insert user message
    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    // Load recent history
    const { data: history } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const reply = await generateReply(history || []);

    // Insert bot message
    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "bot",
      content: reply,
    });

    // Touch conversation
    await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    // Send push back
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          userId: user.id,
          title: "Tre",
          body: reply.length > 240 ? reply.slice(0, 240) + "…" : reply,
          conversationId,
        }),
      });
    } catch (e) {
      console.error("send-push call failed", e);
    }

    return new Response(JSON.stringify({ ok: true, conversationId, reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
