import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function syncUser({ request }: { request: Request }) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVCE_KEY;
  if (!url || !serviceKey) {
    return new Response("Supabase server configuration is missing", { status: 500 });
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
  const { data: existing } = await supabase
    .from("nprep_users")
    .select("auth_json,profile_json,raw_data_json")
    .eq("mobile", mobile)
    .maybeSingle();

  const { error } = await supabase.from("nprep_users").upsert({
    mobile,
    country_code: "+91",
    auth_json: body.auth ?? existing?.auth_json ?? {},
    profile_json: body.profile ?? existing?.profile_json ?? {},
    raw_data_json: body.raw ?? existing?.raw_data_json ?? {},
  }, { onConflict: "mobile" });

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ saved: true, mobile });
}

export const Route = createFileRoute("/api/users/sync")({
  server: { handlers: { POST: syncUser } },
});
