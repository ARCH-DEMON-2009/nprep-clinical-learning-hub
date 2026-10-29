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
  const src = media.find(([, url]) => /\.mpd(?:[?#]|$)/i.test(url))?.[1]
    ?? media.find(([, url]) => /\.(m3u8|mp4|webm)(?:[?#]|$)/i.test(url))?.[1]
    ?? media.find(([key]) => /^(video_?url|stream_?url|playback_?url|manifest_?url|url|src)$/i.test(key))?.[1];
  let queryLicense: string | undefined;
  if (src) {
    const params = new URL(src).searchParams;
    queryLicense = params.get("license_url") ?? params.get("licenseUrl") ?? undefined;
  }
  return {
    src,
    license: license ?? queryLicense,
    notes: [...new Set(urls.filter(([key, url]) => /notes|pdf/i.test(key) || /\.pdf(?:[?#]|$)/i.test(url)).map(([, url]) => url))],
    text: fields.find(([key, content]) => /^(text|content|html|lecture_text|text_content|sk_text)$/i.test(key) && !/^https?:\/\//i.test(content))?.[1],
  };
}

export function playbackMessage(error: any): string {
  const code = error?.code;
  if (code >= 6000 && code < 7000) return `Protected playback could not start (${code}). Check your lecture access and try a browser with protected content enabled.`;
  if (code >= 1000 && code < 2000) return `The video server could not be reached (${code}). Try again to refresh the lecture link.`;
  return `This lecture could not be played${code ? ` (${code})` : ""}. Try again or use another browser.`;
}