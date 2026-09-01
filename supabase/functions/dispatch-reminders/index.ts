import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Cron-invoked. Finds due reminders and sends web push, then marks them sent.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Only the scheduler may run this privileged job.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret") ?? "";
    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const authorized =
      (!!cronSecret && providedSecret === cronSecret) ||
      (!!serviceKey && bearer === serviceKey);

    if (!authorized) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);


    const { data: due, error } = await admin
      .from("reminders")
      .select("id, user_id, title, body, conversation_id")
      .eq("sent", false)
      .lte("remind_at", new Date().toISOString())
      .limit(200);

    if (error) {
      console.error("select err", error);
      return json({ error: error.message }, 500);
    }
    if (!due || due.length === 0) return json({ ok: true, dispatched: 0 });

    let dispatched = 0;
    await Promise.all(due.map(async (r: any) => {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            userId: r.user_id,
            title: `⏰ ${r.title}`,
            body: r.body || "Hatırlatıcı zamanı geldi.",
            conversationId: r.conversation_id,
          }),
        });
        if (!resp.ok) console.error("send-push failed", await resp.text());
        await admin
          .from("reminders")
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq("id", r.id);
        dispatched++;
      } catch (e) {
        console.error("dispatch err", e);
      }
    }));

    return json({ ok: true, dispatched });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
