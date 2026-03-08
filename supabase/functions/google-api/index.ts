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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json();
    const { action, params } = body;

    if (!action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "Action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has connected Google account with required scope
    const { data: account, error: accError } = await supabaseClient
      .from("connected_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: "Google hesabı bağlı değil. Lütfen önce hesabınızı bağlayın." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get provider token from request body or session
    const providerToken = body.provider_token;

    if (!providerToken) {
      return new Response(JSON.stringify({ 
        error: "Google oturum tokenı bulunamadı. Lütfen tekrar Google ile giriş yapın.",
        requireReauth: true 
      }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: unknown;

    switch (action) {
      case "gmail.list": {
        const maxResults = params?.maxResults || 10;
        const q = params?.query || "";
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${providerToken}` },
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`Gmail API error [${resp.status}]: ${err}`);
        }
        result = await resp.json();
        break;
      }

      case "gmail.read": {
        if (!params?.messageId) throw new Error("messageId required");
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${params.messageId}?format=full`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${providerToken}` },
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`Gmail API error [${resp.status}]: ${err}`);
        }
        result = await resp.json();
        break;
      }

      case "drive.list": {
        const maxResults = params?.maxResults || 10;
        const q = params?.query || "";
        const url = `https://www.googleapis.com/drive/v3/files?pageSize=${maxResults}${q ? `&q=${encodeURIComponent(q)}` : ""}&fields=files(id,name,mimeType,modifiedTime,size)`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${providerToken}` },
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`Drive API error [${resp.status}]: ${err}`);
        }
        result = await resp.json();
        break;
      }

      case "calendar.list": {
        const timeMin = params?.timeMin || new Date().toISOString();
        const timeMax = params?.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=${params?.maxResults || 10}`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${providerToken}` },
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`Calendar API error [${resp.status}]: ${err}`);
        }
        result = await resp.json();
        break;
      }

      case "calendar.create": {
        if (!params?.summary) throw new Error("Event summary required");
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${providerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: params.summary,
            description: params.description || "",
            start: { dateTime: params.startTime, timeZone: params.timeZone || "Europe/Istanbul" },
            end: { dateTime: params.endTime, timeZone: params.timeZone || "Europe/Istanbul" },
          }),
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`Calendar API error [${resp.status}]: ${err}`);
        }
        result = await resp.json();
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Google API error:", error);
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
