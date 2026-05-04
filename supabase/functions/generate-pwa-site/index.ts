// Generates a small PWA website (HTML + manifest + icon) from a description,
// uploads it to the public `generated-files` bucket, and returns the public URL
// so it can be packaged into an APK by build-apk.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-voice-mode",
};

interface AiSite {
  title: string;
  short_name: string;
  theme_color: string;
  background_color: string;
  html_body: string; // body inner HTML
  icon_prompt: string; // short prompt for icon
}

async function callAi(prompt: string): Promise<AiSite> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const body = JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content:
          "You design tiny single-page PWAs. Respond ONLY with strict JSON matching: {title, short_name, theme_color (hex), background_color (hex), html_body (string of inner-body HTML using inline CSS, modern, mobile-first, no external scripts), icon_prompt (one short sentence)}. No markdown, no commentary.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  let res: Response | null = null;
  if (LOVABLE_API_KEY) {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) res = null;
  }
  if (!res && OPENROUTER_API_KEY) {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body,
    });
  }
  if (!res || !res.ok) throw new Error("AI tasarımcı şu anda yanıt vermiyor.");
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);
  return {
    title: String(parsed.title || "App").slice(0, 60),
    short_name: String(parsed.short_name || parsed.title || "App").slice(0, 20),
    theme_color: /^#[0-9a-f]{6}$/i.test(parsed.theme_color) ? parsed.theme_color : "#000000",
    background_color: /^#[0-9a-f]{6}$/i.test(parsed.background_color) ? parsed.background_color : "#ffffff",
    html_body: String(parsed.html_body || "<h1>Hello</h1>"),
    icon_prompt: String(parsed.icon_prompt || "minimalist app icon").slice(0, 200),
  };
}

async function generateIconPng(prompt: string): Promise<Uint8Array> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const body = JSON.stringify({
    model: "google/gemini-3.1-flash-image-preview",
    messages: [{
      role: "user",
      content: `Square 512x512 app icon, on a clean solid background, no text, modern minimalist: ${prompt}`,
    }],
    modalities: ["image", "text"],
  });
  let res: Response | null = null;
  if (LOVABLE_API_KEY) {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) res = null;
  }
  if (!res && OPENROUTER_API_KEY) {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body,
    });
  }
  if (!res || !res.ok) throw new Error("İkon üretilemedi.");
  const data = await res.json();
  // Find image url/base64 in response
  const msg = data.choices?.[0]?.message;
  const imgs: any[] = msg?.images || [];
  let dataUrl: string | undefined = imgs[0]?.image_url?.url || imgs[0]?.url;
  if (!dataUrl) {
    const m = String(msg?.content || "").match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (m) dataUrl = m[0];
  }
  if (!dataUrl) throw new Error("İkon yanıtı boş.");
  const b64 = dataUrl.split(",")[1];
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description } = await req.json();
    if (!description || typeof description !== "string" || description.length > 2000) {
      return new Response(JSON.stringify({ error: "description (max 2000 chars) gerekli" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const site = await callAi(description);
    let iconBytes: Uint8Array;
    try {
      iconBytes = await generateIconPng(site.icon_prompt);
    } catch {
      // Fallback: tiny solid-color PNG (1x1) — APK will still build with default icon.
      iconBytes = Uint8Array.from(atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      ), (c) => c.charCodeAt(0));
    }

    const folder = `${user.id}/pwa-${crypto.randomUUID()}`;
    const escapedTitle = site.title.replace(/[<>&"]/g, "");
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${site.theme_color}">
<title>${escapedTitle}</title>
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" href="icon-512.png">
<link rel="apple-touch-icon" href="icon-512.png">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:${site.background_color};color:#111;min-height:100vh;-webkit-font-smoothing:antialiased}
</style>
</head>
<body>
${site.html_body}
<script>
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
</script>
</body>
</html>`;

    const manifest = {
      name: site.title,
      short_name: site.short_name,
      start_url: "index.html",
      scope: "./",
      display: "standalone",
      background_color: site.background_color,
      theme_color: site.theme_color,
      icons: [
        { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      ],
    };

    const sw = `self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>self.clients.claim());
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});`;

    const uploads: Array<[string, Uint8Array | string, string]> = [
      ["index.html", html, "text/html; charset=utf-8"],
      ["manifest.json", JSON.stringify(manifest, null, 2), "application/manifest+json"],
      ["sw.js", sw, "application/javascript"],
      ["icon-512.png", iconBytes, "image/png"],
      ["icon-192.png", iconBytes, "image/png"],
    ];

    for (const [name, content, contentType] of uploads) {
      const uploadBody = new Blob([content], { type: contentType });
      const { error } = await adminClient.storage
        .from("generated-files")
        .upload(`${folder}/${name}`, uploadBody, { contentType, upsert: true });
      if (error) throw new Error(`Yükleme hatası (${name}): ${error.message}`);
    }

    const { data: pub } = adminClient.storage
      .from("generated-files")
      .getPublicUrl(`${folder}/index.html`);
    const baseUrl = pub.publicUrl.replace(/\/index\.html$/, "");

    return new Response(JSON.stringify({
      siteUrl: pub.publicUrl,
      indexUrl: pub.publicUrl,
      manifestUrl: `${baseUrl}/manifest.json`,
      iconUrl: `${baseUrl}/icon-512.png`,
      title: site.title,
      themeColor: site.theme_color,
      backgroundColor: site.background_color,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-pwa-site error:", error);
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
