import { unwrap } from "./api";
import { isNprepSiteHost, normalizeCloudFrontSignedUrl } from "./media-proxy";

export function lectureData(response: unknown): any {
  const root = unwrap(response);
  return Array.isArray(root) ? root[0] : root?.video ?? root?.lecture ?? root;
}

function entries(value: any, depth = 0): [string, string][] {
  if (!value || typeof value !== "object" || depth > 6) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "string" ? [[key, child] as [string, string]] : entries(child, depth + 1));
}

function findObject(value: any, re: RegExp, depth = 0): any {
  if (!value || typeof value !== "object" || depth > 6) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (re.test(key) && child && typeof child === "object" && !Array.isArray(child)) return child;
    const found = findObject(child, re, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export function lectureMedia(value: any) {
  const fields = entries(value);
  const urls = fields.filter(([, url]) => /^https?:\/\//i.test(url));
  const license = urls.find(([key]) => /license_?url|license_?server|widevine/i.test(key))?.[1];
  // Share links (links.nprep.in) open the app store page, not a video stream.
  const media = urls.filter(([key, url]) => !/license|notes|pdf|image|thumb|poster|share|avatar|logo/i.test(key) && !/^https:\/\/links\.nprep\.in\//i.test(url));
  const scoreMediaUrl = ([key, url]: [string, string]) => {
    let score = /^(video_?url|stream_?url|playback_?url|manifest_?url)$/i.test(key) ? 30 : 0;
    if (/\.(mpd|m3u8|mp4|webm)(?:[?#]|$)/i.test(url)) score += 20;
    try {
      const params = new URL(url).searchParams;
      const signedKeys = [...params.keys()].map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
      if (signedKeys.some((key) => key === "keypairid" || key === "cloudfrontkeypairid")) score += 100;
      if (signedKeys.some((key) => key === "policy" || key === "cloudfrontpolicy")) score += 20;
      if (signedKeys.some((key) => key === "signature" || key === "cloudfrontsignature")) score += 20;
      if (signedKeys.includes("expires")) score += 10;
    } catch {}
    return score;
  };
  let src = [...media].sort((a, b) => scoreMediaUrl(b) - scoreMediaUrl(a))[0]?.[1];
  // The app sends cloud_front_auth as cookies; browsers can't, so carry them as signed URL params.
  const cf = findObject(value, /^cloud_?front_?(auth|cookies?)$/i);
  if (src && cf) {
    try {
      const url = new URL(src);
      const map: [RegExp, string][] = [[/key_?pair_?id/i, "Key-Pair-Id"], [/policy/i, "Policy"], [/signature/i, "Signature"], [/expires/i, "Expires"]];
      for (const [key, raw] of Object.entries(cf)) {
        const name = map.find(([re]) => re.test(key))?.[1];
        if (name && raw != null && !url.searchParams.has(name)) url.searchParams.set(name, String(raw));
      }
      src = url.toString();
    } catch {}
  }
  const drm = findObject(value, /^drm$/i);
  const drmHeaders: Record<string, string> = {};
  if (drm?.headers && typeof drm.headers === "object") {
    for (const [k, h] of Object.entries(drm.headers)) if (typeof h === "string" && k.toLowerCase() !== "content-type") drmHeaders[k] = h;
  }
  let queryLicense: string | undefined;
  let drmType = fields.find(([key]) => /^drm_?type$/i.test(key))?.[1] ?? (typeof drm?.type === "string" ? drm.type : undefined);
  if (src) {
    const params = new URL(src).searchParams;
    queryLicense = [...params.entries()].find(([key]) => key.toLowerCase() === "license_url" || key.toLowerCase() === "licenseurl")?.[1];
    drmType ??= [...params.entries()].find(([key]) => key.toLowerCase() === "drm_type" || key.toLowerCase() === "drmtype")?.[1];
  }
  // TPStreams player links supplied by NPrep play on the service's own authorized page.
  const embed = urls.find(([, url]) => /^https:\/\/(?:app\.)?tpstreams\.com\/embed\//i.test(url))?.[1];
  return {
    embed,
    src,
    license: license ?? queryLicense,
    drmType,
    drmHeaders: Object.keys(drmHeaders).length ? drmHeaders : undefined,
    notes: [...new Set(urls.filter(([key, url]) => /notes|pdf/i.test(key) || /\.pdf(?:[?#]|$)/i.test(url)).map(([, url]) => url))],
    text: fields.find(([key, content]) => /^(text|content|html|lecture_text|text_content|sk_text)$/i.test(key) && !/^https?:\/\//i.test(content))?.[1],
  };
}

const LOCK_MESSAGES: Record<string, string> = {
  SUBSCRIPTION_ACCESS_DENIED: "This lecture is part of a paid NPrep plan that your account doesn't have. Free lectures in this course will still play.",
  COMING_SOON: "This lecture hasn't been released yet.",
};

/** NPrep withholds the video when a lecture is locked; report why instead of trying to play it. */
export function lectureLock(value: any): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const reason = typeof value.lock_reason === "string" ? value.lock_reason : undefined;
  if (value.is_accessible !== false && !reason) return undefined;
  if (value.is_comming_soon === true || value.is_coming_soon === true) return LOCK_MESSAGES.COMING_SOON;
  return (reason && LOCK_MESSAGES[reason.toUpperCase()]) ?? "NPrep has locked this lecture for your account.";
}

export function drmKeySystem(drmType?: string): string {
  const type = (drmType ?? "widevine").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["fairplay", "fps", "comapplefps10"].includes(type)) return "com.apple.fps.1_0";
  if (["playready", "pr", "commicrosoftplayready"].includes(type)) return "com.microsoft.playready";
  if (["clearkey", "orgw3clearkey"].includes(type)) return "org.w3.clearkey";
  return "com.widevine.alpha";
}

export function ensureDrmLicenseContentType(headers: Record<string, string>): Record<string, string> {
  const clean = Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== "content-type"));
  return { ...clean, "Content-Type": "application/octet-stream" };
}

export function registerLicenseRequestFilter(engine: { registerRequestFilter: (filter: (type: number, request: { headers: Record<string, string>; uris?: string[] }) => void) => void } | null, licenseType: number, token?: string | null, extraHeaders: Record<string, string> = {}) {
  engine?.registerRequestFilter((type, request) => {
    if (type !== licenseType) return;
    request.headers = ensureDrmLicenseContentType({ ...(request.headers ?? {}), ...extraHeaders });
    const trusted = Boolean(request.uris?.length && request.uris.every((uri) => {
      try { const url = new URL(uri); return url.protocol === "https:" && isNprepSiteHost(url.hostname); } catch { return false; }
    }));
    if (token && trusted) request.headers = { ...request.headers, Authorization: `Bearer ${token}` };
  });
}

/** Preserve signatures on same-host segments without leaking them to license servers. */
export function signedMediaRequestUrl(uri: string, manifest: string): string {
  try {
    const source = normalizeCloudFrontSignedUrl(new URL(manifest));
    const target = normalizeCloudFrontSignedUrl(new URL(uri));
    if (target.origin !== source.origin) return uri;
    for (const [key, value] of source.searchParams) {
      if (["Policy", "Signature", "Key-Pair-Id", "Expires"].includes(key) && !target.searchParams.has(key)) target.searchParams.append(key, value);
    }
    return target.toString();
  } catch { return uri; }
}

export function playbackFallbackMode(error: { code?: number }, viaProxy: boolean, resolver: boolean, tried: ReadonlySet<boolean>): boolean | undefined {
  if (resolver || ![1001, 1002, 1003, 4036].includes(error.code ?? 0) || tried.has(!viaProxy)) return undefined;
  return !viaProxy;
}

export function lectureMediaDiagnostics(response: unknown, mediaUrl?: string, licenseUrl?: string, drmType?: string): string {
  const root = lectureData(response);
  const fields = new Set<string>();
  const visit = (value: any, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (/video|media|stream|playback|manifest|cloud.?front|signed|signature|policy|cookie|key.?pair|token|url/i.test(key)) {
        fields.add(key);
      }
      visit(child, depth + 1);
    }
  };
  visit(root);

  let selected = "No media URL selected";
  if (mediaUrl) {
    try {
      const url = new URL(mediaUrl);
      const queryKeys = [...url.searchParams.keys()];
      selected = `Selected media host: ${url.hostname}; query keys: ${queryKeys.length ? queryKeys.join(", ") : "none"}`;
    } catch {}
  }

  let license = "License host: not provided";
  if (licenseUrl) {
    try { license = `License host: ${new URL(licenseUrl).hostname}`; } catch {}
  }

  return `${selected}\nDRM type: ${drmType ?? "not provided"}; ${license}\nRelevant API fields: ${fields.size ? [...fields].slice(0, 30).join(", ") : "none found"}`;
}

export function playbackMessage(error: any, licenseUrl?: string, drmType?: string): string {
  const code = typeof error?.code === "number" ? error.code : Number(error?.code);
  if (code === 4036) {
    return "NPrep's video service blocked this request because it came from outside India. Turn off any VPN, use an Indian connection, and press Retry playback.";
  }
  if (code === 6001) {
    return "Your browser could not initialize Widevine protected playback. Enable protected content in Chrome or Edge settings, close Incognito/private mode, restart the browser, and retry.";
  }
  if (code === 6007) {
    const values: unknown[] = [];
    const collect = (value: any, depth = 0) => {
      if (value == null || depth > 5) return;
      if (Array.isArray(value)) return value.forEach((item) => collect(item, depth + 1));
      if (typeof value === "number") return values.push(value);
      if (typeof value === "string") return values.push(value);
      if (typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if (/status|response.?code/i.test(key) && typeof child === "number") values.push(child);
          collect(child, depth + 1);
        }
      }
    };
    collect(error?.data);
    const status = values.find((value) => typeof value === "number" && value >= 100 && value <= 599);
    const body = values.find((value): value is string => typeof value === "string" && !/^https?:\/\//i.test(value));
    const safeBody = body?.replace(/<[^>]*>/g, " ")
      .replace(/([?&](?:token|signature|key|auth)=)[^&\s"']*/gi, "$1[redacted]")
      .replace(/\s+/g, " ").trim().slice(0, 100);
    let host = "";
    try { host = licenseUrl ? new URL(licenseUrl).hostname : ""; } catch {}
    const details = [
      status ? `HTTP ${status}` : "",
      host ? `from ${host}` : "",
      drmType ? `DRM ${drmType}` : "",
      safeBody || "",
    ].filter(Boolean).join("; ");
    return `DRM license request failed${details ? ` (${details})` : ` (${code})`}. Check the license server and lecture access.`;
  }
  if (code >= 6000 && code < 7000) return `Protected playback could not start (${code}). Check your lecture access and try a browser with protected content enabled.`;
  if (code === 1001) {
    const data = Array.isArray(error?.data) ? error.data : [error?.data];
    const status = Number.isInteger(data[1]) ? data[1] : data.find((value: any) => Number.isInteger(value) && value >= 100 && value <= 599);
    const body = typeof data[2] === "string"
      ? data[2]
        .replace(/<[^>]*>/g, " ")
        .replace(/([?&](?:token|signature|key|auth)=)[^&\s"']*/gi, "$1[redacted]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120)
      : "";
    let hostname = "";
    try {
      hostname = new URL(String(data[0] ?? "")).hostname;
    } catch {}
    const rawBody = typeof data[2] === "string" ? data[2] : "";
    if ([521, 502, 504].includes(status) && !/resolver did not return a media URL/i.test(rawBody)) return `The video service is temporarily unreachable (HTTP ${status}). Retry playback in a moment or try the other playback connection.`;
    if (status === 403 && /block access from your country/i.test(rawBody)) {
      const region = rawBody.match(/relay region:\s*([a-z0-9-]+)/i)?.[1];
      if (region && region.toLowerCase() !== "bom1") {
        return `NPrep's video service only serves India, but this website's video relay ran in server region "${region}" (outside India). Set the hosting function region to Mumbai (bom1), redeploy, then press Retry playback.`;
      }
      return "NPrep's video service blocked this request because it came from outside India. Turn off any VPN, use an Indian connection, and press Retry playback.";
    }
    if (status === 403 && /media host is not allowed/i.test(body)) {
      return "The lecture media host is not on the proxy allowlist. Add its CDN domain to the media proxy configuration.";
    }
    if (status) {
      const source = hostname ? ` from ${hostname}` : "";
      const reason = body ? `: ${body}` : "";
      return `The video server rejected the request (HTTP ${status}${source}${reason}). Refresh the lecture link or check lecture access.`;
    }
  }
  if (code >= 1000 && code < 2000) return `The video server could not be reached (${code}). Try again to refresh the lecture link.`;
  return `This lecture could not be played${code ? ` (${code})` : ""}. Try again or use another browser.`;
}