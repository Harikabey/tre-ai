import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    VAPID_SUBJECT.startsWith("mailto:") || VAPID_SUBJECT.startsWith("http")
      ? VAPID_SUBJECT
      : `mailto:${VAPID_SUBJECT}`,
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const body = await req.json().catch(() => ({}));
    let targetUserId: string | null = null;

    // Internal call (service role) — can target any user
    if (token === serviceKey && typeof body.userId === "string") {
      targetUserId = body.userId;
    } else {
      // User call — send to self only
      const { data: { user }, error: uErr } = await admin.auth.getUser(token);
      if (uErr || !user) {
        return new Response(JSON.stringify({ error: "Auth required" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = user.id;
    }

    const title = (body.title || "Tre").toString().slice(0, 100);
    const message = (body.body || body.message || "").toString().slice(0, 500);
    const conversationId = body.conversationId || null;

    const { data: subs, error: sErr } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("is_active", true);

    if (sErr) {
      return new Response(JSON.stringify({ error: sErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body: message, conversationId, url: "/" });
    let sent = 0;
    const deadEndpoints: string[] = [];

    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        }, payload);
        sent++;
      } catch (e: any) {
        console.error("push fail", s.endpoint, e?.statusCode, e?.body);
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          deadEndpoints.push(s.endpoint);
        }
      }
    }));

    if (deadEndpoints.length > 0) {
      await admin.from("push_subscriptions")
        .update({ is_active: false })
        .in("endpoint", deadEndpoints);
    }

    return new Response(JSON.stringify({ ok: true, sent, dead: deadEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
