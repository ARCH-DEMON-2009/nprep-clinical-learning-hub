function encodePart(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodePart(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeMediaTarget(target: string): string {
  const parts = target.split(/(\$[^$]+\$)/g);
  if (!parts.some((part) => /^\$[^$]+\$$/.test(part))) return encodePart(target);
  return parts.map((part) => /^\$[^$]+\$$/.test(part) ? `v${part}` : `s${encodePart(part)}`).join("~");
}

export function decodeMediaTarget(encoded: string): string {
  if (!encoded.includes("~")) return decodePart(encoded);
  return encoded.split("~").map((part) => {
    if (part.startsWith("v")) return part.slice(1);
    if (part.startsWith("s")) return decodePart(part.slice(1));
    throw new Error("Invalid media URL encoding");
  }).join("");
}

export function mediaProxyUrl(target: string): string {
  const encoded = encodeMediaTarget(target);
  return `/api/media/relay/${encoded}/`;
}

export function embeddedMediaRedirect(html: string): string | undefined {
  const destination = html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)/i)?.[1]
    ?? html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)/i)?.[1]
    ?? html.match(/(?:href|url)["']?\s*[:=]\s*["'](https?:\/\/[^"']+)/i)?.[1];
  return destination?.replace(/&amp;/gi, "&").replace(/["']+$/, "");
}

export function normalizeCloudFrontSignedUrl(target: URL): URL {
  const aliases: Record<string, string> = {
    cloudfrontpolicy: "Policy",
    cloudfrontsignature: "Signature",
    cloudfrontkeypairid: "Key-Pair-Id",
  };
  const query = target.search.slice(1);
  if (!query) return target;
  const parts = query.split("&");
  const existing = new Set(parts.map((part) => part.slice(0, part.indexOf("=") < 0 ? undefined : part.indexOf("=")).toLowerCase()));
  const renamed = parts.map((part) => {
    const equals = part.indexOf("=");
    const rawKey = equals < 0 ? part : part.slice(0, equals);
    let decodedKey = rawKey;
    try { decodedKey = decodeURIComponent(rawKey.replace(/\+/g, " ")); } catch {}
    const canonical = aliases[normalizedKey(decodedKey)];
    if (!canonical) return part;
    if (existing.has(canonical.toLowerCase())) return null;
    existing.add(canonical.toLowerCase());
    return `${canonical}${equals < 0 ? "" : part.slice(equals)}`;
  }).filter((part): part is string => part != null);
  target.search = renamed.length ? `?${renamed.join("&")}` : "";
  return target;
}

const CLOUDFRONT_COOKIE = /^CloudFront-(?:Policy|Signature|Key-Pair-Id)$/i;
const CLOUDFRONT_NAMES = {
  cloudfrontpolicy: "CloudFront-Policy",
  cloudfrontsignature: "CloudFront-Signature",
  cloudfrontkeypairid: "CloudFront-Key-Pair-Id",
} as const;

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MEDIA_HOSTS = [
  "nprep.in",
  "nprep.site",
  "cloudfront.net",
  "amazonaws.com",
  "akamaized.net",
  "akamaihd.net",
  "googlevideo.com",
  "azureedge.net",
  "blob.core.windows.net",
  "b-cdn.net",
  "bunnycdn.com",
  "cloudflarestream.com",
  "fastly.net",
  "tpstreams.com",
];

export function isAllowedMediaHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  return MEDIA_HOSTS.some((host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`));
}

export function isNprepLinkResolverUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === "links.nprep.in";
  } catch {
    return false;
  }
}

export function isNprepSiteHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  return normalizedHost === "nprep.in" || normalizedHost.endsWith(".nprep.in")
    || normalizedHost === "nprep.site" || normalizedHost.endsWith(".nprep.site");
}

export function nprepSiteOrigin(requestUrl: string, originHeader?: string | null, refererHeader?: string | null): string {
  for (const candidate of [originHeader, refererHeader, requestUrl]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && isNprepSiteHost(url.hostname)) return url.origin;
    } catch {}
  }
  return "https://beta.nprep.site";
}

/** Only unauthenticated OTP sending requires NPrep's verified public origin. */
export function nprepApiOrigin(request: Request, path: string): string {
  if (request.method === "POST" && path === "v3/auth/request-otp" && !request.headers.get("authorization")) {
    return "https://nprep.in";
  }
  return nprepSiteOrigin(request.url, request.headers.get("origin"), request.headers.get("referer"));
}

export function ensureMediaPostContentType(headers: Headers): Headers {
  const result = new Headers(headers);
  if (!result.get("content-type")?.trim()) result.set("content-type", "application/octet-stream");
  return result;
}

function localCookie(pair: string, secure: boolean): string {
  return [pair, "Path=/api/media", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ");
}

export function localMediaCookies(headers: Headers, secure: boolean): string[] {
  const source = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = source.getSetCookie?.() ?? (headers.get("set-cookie") ?? "").split(/,\s*(?=CloudFront-(?:Policy|Signature|Key-Pair-Id)=)/i);
  return setCookies.flatMap((setCookie) => {
    const [pair, ...attributes] = setCookie.split(";");
    const separator = pair?.indexOf("=") ?? -1;
    if (separator <= 0 || !CLOUDFRONT_COOKIE.test(pair!.slice(0, separator).trim())) return [];
    const retained = attributes.filter((attribute) => /^\s*max-age=/i.test(attribute));
    return [[pair!.trim(), ...retained, "Path=/api/media", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ")];
  });
}

export function localMediaCookiesFromPayload(payload: unknown, secure: boolean): string[] {
  const found: Record<string, string> = {};
  const visit = (value: unknown, cloudFrontContext = false, depth = 0): void => {
    if (depth > 8 || value == null) return;
    if (typeof value === "string") {
      const cookiePattern = /(?:^|[;,\s"'])(CloudFront-(?:Policy|Signature|Key-Pair-Id))=([^;,\s"']+)/gi;
      for (const match of value.matchAll(cookiePattern)) {
        const name = match[1];
        const content = match[2];
        if (name && content) found[name] = content;
      }
      return;
    }
    if (typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const name = record["name"] ?? record["key"];
        const content = record["value"] ?? record["content"];
        if (typeof name === "string" && typeof content === "string") {
          const cookieName = CLOUDFRONT_NAMES[normalizedKey(name) as keyof typeof CLOUDFRONT_NAMES];
          if (cookieName) found[cookieName] = content;
        }
        visit(item, cloudFrontContext, depth + 1);
      }
      return;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      const keyName = normalizedKey(key);
      const cookieName = CLOUDFRONT_NAMES[keyName as keyof typeof CLOUDFRONT_NAMES]
        ?? ({
          policy: "CloudFront-Policy",
          signature: "CloudFront-Signature",
          keypairid: "CloudFront-Key-Pair-Id",
          keypair: "CloudFront-Key-Pair-Id",
        }[keyName]);
      if (cookieName && typeof child === "string" && child) found[cookieName] = child;
      const nestedCloudFrontContext = cloudFrontContext || /cloud.?front|signed.?cookies/i.test(key);
      visit(child, nestedCloudFrontContext, depth + 1);
    }
  };

  visit(payload);
  const required = Object.values(CLOUDFRONT_NAMES);
  if (!required.every((name) => found[name])) return [];
  return required.map((name) => localCookie(`${name}=${found[name]}`, secure));
}

export function cloudFrontCookieHeader(cookieHeader: string | null): string | undefined {
  const cookies = cookieHeader?.split(/;\s*/).filter((cookie) => {
    const separator = cookie.indexOf("=");
    return separator > 0 && CLOUDFRONT_COOKIE.test(cookie.slice(0, separator).trim());
  });
  return cookies?.length ? cookies.join("; ") : undefined;
}

export function cloudFrontCredentialSummary(target: URL, cookieNames: Iterable<string>): string {
  const hasKeyPairQuery = [...target.searchParams.keys()]
    .some((key) => ["keypairid", "cloudfrontkeypairid"].includes(normalizedKey(key)));
  const signedNames = [...cookieNames].filter((name) => CLOUDFRONT_COOKIE.test(name));
  const hasKeyPairCookie = signedNames.some((name) => normalizedKey(name) === "cloudfrontkeypairid");
  return `Proxy saw Key-Pair-Id query=${hasKeyPairQuery ? "yes" : "no"}; Key-Pair-Id cookie=${hasKeyPairCookie ? "yes" : "no"}; signed cookies=${signedNames.length ? signedNames.join(",") : "none"}.`;
}

export function rewriteMediaManifest(text: string, manifestUrl: string, contentType: string): string {
  const proxied = (reference: string, base: string) => {
    try {
      const resolved = new URL(reference, base);
      const manifest = new URL(manifestUrl);
      if (resolved.origin === manifest.origin) {
        for (const [key, value] of manifest.searchParams) {
          if (!resolved.searchParams.has(key)) resolved.searchParams.append(key, value);
        }
      }
      return mediaProxyUrl(resolved.toString());
    } catch {
      return reference;
    }
  };

  if (/mpegurl/i.test(contentType) || /\.m3u8(?:[?#]|$)/i.test(manifestUrl)) {
    return text.split(/(\r?\n)/).map((line) => {
      if (!line || /^\s*#/.test(line)) {
        return line.replace(/URI=(['"])(.*?)\1/g, (_match, quote, uri) => `URI=${quote}${proxied(uri, manifestUrl)}${quote}`);
      }
      return proxied(line.trim(), manifestUrl);
    }).join("");
  }

  if (/dash\+xml/i.test(contentType) || /\.mpd(?:[?#]|$)/i.test(manifestUrl)) {
    const rootBase = text.match(/<BaseURL\b[^>]*>([^<]+)<\/BaseURL>/i)?.[1]?.trim();
    const referenceBase = rootBase ? new URL(rootBase, manifestUrl).toString() : manifestUrl;
    return text
      .replace(/(<BaseURL\b[^>]*>)([^<]+)(<\/BaseURL>)/gi,
        (_match, before, url, after) => `${before}${proxied(url.trim(), manifestUrl)}${after}`)
      .replace(/\b(media|initialization|sourceURL|href)=(['"])(.*?)\2/gi,
        (_match, name, quote, url) => `${name}=${quote}${proxied(url, referenceBase)}${quote}`);
  }

  return text;
}