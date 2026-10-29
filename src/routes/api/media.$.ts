import { createFileRoute } from "@tanstack/react-router";
import { cloudFrontCookieHeader, cloudFrontCredentialSummary, decodeMediaTarget, ensureMediaPostContentType, isAllowedMediaHost, localMediaCookies, normalizeCloudFrontSignedUrl, rewriteMediaManifest } from "@/lib/media-proxy";

const MEDIA_TOKEN_COOKIE = "nprep_media_token";

function allowedTarget(url: URL): boolean {
  if (!(url.protocol === "https:" || url.protocol === "http:") || url.username || url.password) return false;
  return isAllowedMediaHost(url.hostname);
}

function isNprepHost(hostname: string): boolean {
  return hostname === "nprep.in" || hostname.endsWith(".nprep.in");
}

async function forward({ request, params }: { request: Request; params: { _splat?: string } }) {
  const [relay, encoded, ...suffix] = (params._splat ?? "").split("/");
  if (relay === "session") {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (request.method !== "POST" || !token) return new Response("Unauthorized", { status: 401 });
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return new Response(null, {
      status: 204,
      headers: {
        "set-cookie": `${MEDIA_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/api/media; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`,
      },
    });
  }
  if (relay !== "relay" || !encoded) return new Response("Not found", { status: 404 });

  let target: URL;
  try {
    target = normalizeCloudFrontSignedUrl(new URL(decodeMediaTarget(encoded)));
    if (target.protocol === "http:" && isNprepHost(target.hostname.toLowerCase())) {
      target.protocol = "https:";
    }
    if (suffix.length) {
      const base = target.toString();
      target = new URL(suffix.join("/"), base);
      if (!new URL(request.url).search && new URL(base).search) target.search = new URL(base).search;
    } else {
      target.search = new URL(request.url).search || target.search;
    }
  } catch {
    return new Response("Invalid media URL", { status: 400 });
  }

  if (!allowedTarget(target)) return new Response("Media host is not allowed", { status: 403 });

  const headers = new Headers();
  headers.set("origin", "https://nprep.in");
  headers.set("referer", "https://nprep.in/");
  for (const name of ["range", "if-range", "if-none-match", "if-modified-since", "content-type", "accept", "accept-language", "user-agent", "authorization", "soapaction"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (request.method === "POST") {
    const withContentType = ensureMediaPostContentType(headers);
    withContentType.forEach((value, name) => headers.set(name, value));
  }
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${MEDIA_TOKEN_COOKIE}=([^;]+)`))?.[1];
  const appToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?? (cookie ? decodeURIComponent(cookie) : undefined);
  if (appToken && isNprepHost(target.hostname.toLowerCase())) {
    headers.set("authorization", `Bearer ${appToken}`);
  } else {
    headers.delete("authorization");
  }
  const cloudFrontCookies = cloudFrontCookieHeader(request.headers.get("cookie"));
  const signedCookies = new Map<string, string>();
  for (const cookie of cloudFrontCookies?.split(/;\s*/) ?? []) {
    const separator = cookie.indexOf("=");
    if (separator > 0) signedCookies.set(cookie.slice(0, separator), cookie.slice(separator + 1));
  }
  const supportsSignedCookies = (hostname: string) => hostname.toLowerCase().endsWith(".cloudfront.net") || isNprepHost(hostname.toLowerCase());
  const signedCookieHeader = () => [...signedCookies].map(([name, value]) => `${name}=${value}`).join("; ");
  if (signedCookies.size && supportsSignedCookies(target.hostname)) {
    headers.set("cookie", signedCookieHeader());
  }

  let method = request.method;
  let body = method === "POST" ? await request.arrayBuffer() : undefined;
  let upstream: Response | undefined;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (!allowedTarget(target)) return new Response("Media host is not allowed", { status: 403 });
    try {
      upstream = await fetch(target, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        redirect: "manual",
      });
    } catch {
      return new Response("Media server could not be reached", { status: 502 });
    }
    const secure = new URL(request.url).protocol === "https:";
    for (const cookie of localMediaCookies(upstream.headers, secure)) {
      const pair = cookie.split(";", 1)[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator > 0) signedCookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    if (signedCookies.size) {
      const cookieHeader = [...signedCookies].map(([name, value]) => `${name}=${value}`).join("; ");
      if (supportsSignedCookies(target.hostname)) {
        headers.set("cookie", cookieHeader);
      }
    }
    if (upstream.status === 403 && (method === "GET" || method === "HEAD")) {
      await upstream.body?.cancel();
      const origin = headers.get("origin");
      const fallbackSite = origin === "https://nprep.in" ? "https://api.nprep.in" : "https://nprep.in";
      headers.set("origin", fallbackSite);
      headers.set("referer", `${fallbackSite}/`);
      try {
        upstream = await fetch(target, { method, headers, redirect: "manual" });
      } catch {
        return new Response("Media server could not be reached", { status: 502 });
      }
    }
    const location = upstream.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(upstream.status) || !location) break;
    await upstream.body?.cancel();
    if (redirects === 5) return new Response("Too many media redirects", { status: 502 });
    const previousOrigin = target.origin;
    target = new URL(location, target);
    if (target.origin !== previousOrigin && !isNprepHost(target.hostname.toLowerCase())) {
      headers.delete("authorization");
    }
    if (signedCookies.size && supportsSignedCookies(target.hostname)) {
      headers.set("cookie", signedCookieHeader());
    } else {
      headers.delete("cookie");
    }
    if (upstream.status === 303 || ([301, 302].includes(upstream.status) && method === "POST")) {
      method = "GET";
      body = undefined;
      headers.delete("content-type");
    }
  }
  if (!upstream) return new Response("Media server could not be reached", { status: 502 });

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const responseHeaders = new Headers({
    "content-type": contentType,
    "access-control-allow-origin": "*",
  });
  for (const [name, value] of signedCookies) {
    const secure = new URL(request.url).protocol === "https:";
    responseHeaders.append("set-cookie", [
      `${name}=${value}`,
      "Path=/api/media",
      "HttpOnly",
      "SameSite=Lax",
      ...(secure ? ["Secure"] : []),
    ].join("; "));
  }
  for (const name of ["content-length", "content-range", "accept-ranges", "cache-control", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  if (upstream.status === 403) {
    const body = await upstream.clone().text();
    if (/MissingKey|Key-Pair-Id/i.test(body)) {
      responseHeaders.set("content-type", "text/plain; charset=utf-8");
      responseHeaders.delete("content-length");
      return new Response(`${cloudFrontCredentialSummary(target, signedCookies.keys())} ${body}`, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }
  }

  if (request.method === "HEAD" || upstream.status === 204 || upstream.status === 304) {
    return new Response(null, { status: upstream.status, headers: responseHeaders });
  }

  if (/mpegurl|dash\+xml/i.test(contentType) || /\.(m3u8|mpd)(?:[?#]|$)/i.test(target.toString())) {
    const manifest = rewriteMediaManifest(await upstream.text(), target.toString(), contentType);
    responseHeaders.delete("content-length");
    return new Response(manifest, { status: upstream.status, headers: responseHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const Route = createFileRoute("/api/media/$")({
  server: { handlers: { GET: forward, HEAD: forward, POST: forward } },
});