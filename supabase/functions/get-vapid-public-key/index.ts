import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const pub = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  return new Response(JSON.stringify({ publicKey: pub }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
