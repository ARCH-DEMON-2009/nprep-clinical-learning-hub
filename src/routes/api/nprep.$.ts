import { createFileRoute } from "@tanstack/react-router";

// Transparent pass-through to the NPrep backend so the browser avoids CORS.
// It holds no secrets: the caller's own bearer token is forwarded unchanged.
async function forward({ request, params }: { request: Request; params: { _splat?: string } }) {
  const url = new URL(request.url);
  const target = `https://api.nprep.in/${params._splat ?? ""}${url.search}`;
  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("accept", "application/json");
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : undefined,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export const Route = createFileRoute("/api/nprep/$")({
  server: {
    handlers: { GET: forward, POST: forward, PUT: forward, PATCH: forward, DELETE: forward },
  },
});
