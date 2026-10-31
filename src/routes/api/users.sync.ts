import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function syncUser({ request }: { request: Request }) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVCE_KEY;
  if (!url || !serviceKey) {
    return new Response("User storage is not configured", { status: 503 });
  }

  let body: { mobile?: string; auth?: unknown; profile?: unknown; raw?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const mobile = String(body.mobile ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return new Response("A valid mobile number is required", { status: 400 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing, error: readError } = await supabase
    .from("nprep_users")
    .select("auth_json,profile_json,raw_data_json")
    .eq("mobile", mobile)
    .maybeSingle();
  if (readError) return new Response("Could not read existing user data", { status: 500 });

  const mergeJson = (current: unknown, incoming: unknown) => {
    if (incoming == null) return current && typeof current === "object" ? current : {};
    if (current && typeof current === "object" && !Array.isArray(current)
      && incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
      return { ...current as Record<string, unknown>, ...incoming as Record<string, unknown> };
    }
    return incoming;
  };

  const { error } = await supabase.from("nprep_users").upsert({
    mobile,
    country_code: "+91",
    auth_json: mergeJson(existing?.auth_json, body.auth),
    profile_json: mergeJson(existing?.profile_json, body.profile),
    raw_data_json: mergeJson(existing?.raw_data_json, body.raw),
    updated_at: new Date().toISOString(),
  }, { onConflict: "mobile" });

  if (error) return new Response("Could not save user data", { status: 500 });
  return Response.json({ saved: true, mobile }, { headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/users/sync")({
  server: { handlers: { POST: syncUser } },
});
