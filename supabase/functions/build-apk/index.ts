// Builds a real signed APK from a Progressive Web App URL using PWABuilder's public API.
// PWABuilder is Microsoft's free, open-source service for packaging PWAs as native apps.
// API ref: https://docs.pwabuilder.com/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-mode",
};

// Block private/loopback addresses to prevent SSRF.
function isSafeUrl(input: string): boolean {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host === "0.0.0.0" ||
      host.includes("metadata.google") ||
      host.includes("169.254.169.254")
    ) return false;
    return true;
  } catch {
    return false;
  }
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

    const body = await req.json();
    const { url, packageId, appName, manifestUrl, iconUrl, themeColor, backgroundColor } = body as {
      url: string; packageId?: string; appName?: string;
      manifestUrl?: string; iconUrl?: string; themeColor?: string; backgroundColor?: string;
    };

    if (!url || typeof url !== "string" || !isSafeUrl(url)) {
      return new Response(JSON.stringify({
        error: "Geçerli, herkese açık bir https URL gerekli (ör: https://senin-sitesi.com).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sensible defaults — packageId reverse-DNS, appName from hostname
    const hostname = new URL(url).hostname;
    const safePackageId = (packageId || `app.tre.${hostname.replace(/[^a-z0-9]/gi, "").toLowerCase()}`).slice(0, 60);
    const safeAppName = (appName || hostname.split(".")[0] || "Tre App").slice(0, 40);

    // PWABuilder generate endpoint — produces signed APK + Play Store ZIP.
    const pwaBuilderUrl = "https://pwabuilder-cloudapk-pre.azurewebsites.net/generateAppPackage";
    const apkRequest = {
      packageId: safePackageId,
      name: safeAppName,
      launcherName: safeAppName.slice(0, 30),
      appVersion: "1.0.0",
      appVersionCode: 1,
      display: "standalone",
      host: hostname,
      themeColor: themeColor || "#000000",
      navigationColor: themeColor || "#000000",
      navigationColorDark: themeColor || "#000000",
      navigationDividerColor: themeColor || "#000000",
      navigationDividerColorDark: themeColor || "#000000",
      backgroundColor: backgroundColor || "#ffffff",
      startUrl: "/",
      iconUrl: iconUrl || `${url.replace(/\/$/, "")}/icon-512.png`,
      maskableIconUrl: null,
      monochromeIconUrl: null,
      shortcuts: [],
      signingMode: "new",
      signing: {
        file: null,
        alias: "tre-key",
        fullName: `Tre ${safeAppName}`,
        organization: "Tre by Treasure",
        organizationalUnit: "Mobile",
        countryCode: "US",
        keyPassword: "",
        storePassword: "",
      },
      webManifestUrl: manifestUrl || `${url.replace(/\/$/, "")}/manifest.json`,
      fallbackType: "customtabs",
      enableNotifications: false,
      features: { locationDelegation: { enabled: false }, playBilling: { enabled: false } },
    };

    console.log("PWABuilder request for:", url);
    const pwaResponse = await fetch(pwaBuilderUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apkRequest),
    });

    if (!pwaResponse.ok) {
      const errText = await pwaResponse.text();
      console.error("PWABuilder error:", pwaResponse.status, errText.slice(0, 500));
      return new Response(JSON.stringify({
        error: `APK üretimi başarısız (${pwaResponse.status}). Sitenin geçerli bir PWA manifest dosyası olmalı (${url}/manifest.json). Detay: ${errText.slice(0, 200)}`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apkZip = new Uint8Array(await pwaResponse.arrayBuffer());
    if (apkZip.length < 1000) {
      return new Response(JSON.stringify({ error: "PWABuilder beklenmedik küçük bir dosya döndürdü." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeName = `${safeAppName.replace(/[^a-zA-Z0-9._-]/g, "_")}-android.zip`;
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await adminClient.storage
      .from("generated-files")
      .upload(storagePath, apkZip, { contentType: "application/zip", upsert: false });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Yükleme başarısız: ${uploadError.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = adminClient.storage.from("generated-files").getPublicUrl(storagePath);
    return new Response(JSON.stringify({
      url: pub.publicUrl,
      filename: safeName,
      size: apkZip.length,
      packageId: safePackageId,
      appName: safeAppName,
      note: "ZIP içinde imzalanmış .apk dosyası ve Google Play için hazır .aab bulunur.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("build-apk error:", error);
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
