import { unwrap } from "./api";

export function lectureData(response: unknown): any {
  const root = unwrap(response);
  return Array.isArray(root) ? root[0] : root?.video ?? root?.lecture ?? root;
}

function entries(value: any, depth = 0): [string, string][] {
  if (!value || typeof value !== "object" || depth > 6) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "string" ? [[key, child] as [string, string]] : entries(child, depth + 1));
}

export function lectureMedia(value: any) {
  const fields = entries(value);
  const urls = fields.filter(([, url]) => /^https?:\/\//i.test(url));
  const license = urls.find(([key]) => /license_?url|license_?server|widevine/i.test(key))?.[1];
  const media = urls.filter(([key]) => !/license|notes|pdf|image|thumbnail|poster/i.test(key));
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
  const src = [...media].sort((a, b) => scoreMediaUrl(b) - scoreMediaUrl(a))[0]?.[1];
  let queryLicense: string | undefined;
  let drmType = fields.find(([key]) => /^drm_?type$/i.test(key))?.[1];
  if (src) {
    const params = new URL(src).searchParams;
    queryLicense = [...params.entries()].find(([key]) => key.toLowerCase() === "license_url" || key.toLowerCase() === "licenseurl")?.[1];
    drmType ??= [...params.entries()].find(([key]) => key.toLowerCase() === "drm_type" || key.toLowerCase() === "drmtype")?.[1];
  }
  return {
    src,
    license: license ?? queryLicense,
    drmType,
    notes: [...new Set(urls.filter(([key, url]) => /notes|pdf/i.test(key) || /\.pdf(?:[?#]|$)/i.test(url)).map(([, url]) => url))],
    text: fields.find(([key, content]) => /^(text|content|html|lecture_text|text_content|sk_text)$/i.test(key) && !/^https?:\/\//i.test(content))?.[1],
  };
}

export function drmKeySystem(drmType?: string): string {
  const type = (drmType ?? "widevine").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["fairplay", "fps", "comapplefps10"].includes(type)) return "com.apple.fps.1_0";
  if (["playready", "pr", "commicrosoftplayready"].includes(type)) return "com.microsoft.playready";
  if (["clearkey", "orgw3clearkey"].includes(type)) return "org.w3.clearkey";
  return "com.widevine.alpha";
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
  const code = error?.code;
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