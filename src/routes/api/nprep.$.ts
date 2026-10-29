import { createFileRoute } from "@tanstack/react-router";
import { localMediaCookies, localMediaCookiesFromPayload } from "@/lib/media-proxy";

// Transparent pass-through to the NPrep backend so the browser avoids CORS.
// It holds no secrets: the caller's own bearer token is forwarded unchanged.
async function forward({ request, params }: { request: Request; params: { _splat?: string } }) {
  const url = new URL(request.url);
  let target = new URL(`https://api.nprep.in/${params._splat ?? ""}${url.search}`);
  const headers = new Headers();
  headers.set("origin", "https://nprep.in");
  headers.set("referer", "https://nprep.in/");
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers.set("user-agent", userAgent);
  headers.set("accept", "application/json");
  let method = request.method;
  let body: BodyInit | undefined = ["GET", "HEAD"].includes(method) ? undefined : await request.text();
  const signedCookies = new Map<string, string>();
  let res: Response | undefined;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    res = await fetch(target, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      redirect: "manual",
    });
    for (const cookie of localMediaCookies(res.headers, new URL(request.url).protocol === "https:")) {
      const pair = cookie.split(";", 1)[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator > 0) signedCookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const location = res.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(res.status) || !location) break;
    if (redirects === 5) return new Response("Too many NPrep redirects", { status: 502 });
    await res.body?.cancel();
    const next = new URL(location, target);
    const hostname = next.hostname.toLowerCase();
    const trusted = hostname === "nprep.in" || hostname.endsWith(".nprep.in")
      || hostname.endsWith(".cloudfront.net") || hostname.endsWith(".amazonaws.com");
    if (next.protocol !== "https:" || !trusted) return new Response("NPrep redirected to an untrusted media host", { status: 502 });
    if (hostname !== "nprep.in" && !hostname.endsWith(".nprep.in")) headers.delete("authorization");
    target = next;
    if (res.status === 303 || ([301, 302].includes(res.status) && method === "POST")) {
      method = "GET";
      body = undefined;
      headers.delete("content-type");
    }
  }
  if (!res) return new Response("NPrep server could not be reached", { status: 502 });

  const responseHeaders = new Headers({
    "content-type": res.headers.get("content-type") ?? "application/json",
  });
  const secure = new URL(request.url).protocol === "https:";
  for (const [name, value] of signedCookies) {
    responseHeaders.append("set-cookie", [
      `${name}=${value}`,
      "Path=/api/media",
      "HttpOnly",
      "SameSite=Lax",
      ...(secure ? ["Secure"] : []),
    ].join("; "));
  }
  const responseBody = await res.text();
  try {
    const payload = JSON.parse(responseBody);
    for (const cookie of localMediaCookiesFromPayload(payload, secure)) {
      responseHeaders.append("set-cookie", cookie);
    }
  } catch {
    // Non-JSON API responses can still provide signed cookies through Set-Cookie.
  }
  return new Response(responseBody, {
    status: res.status,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/nprep/$")({
  server: {
    handlers: { GET: forward, POST: forward, PUT: forward, PATCH: forward, DELETE: forward },
  },
});
