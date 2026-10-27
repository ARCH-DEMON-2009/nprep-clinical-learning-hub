const TOKEN_KEY = "nprep_token";
const BASE = "/api/nprep/v3";

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  if (res.status === 401 && token) {
    clearToken();
    window.location.href = "/login";
  }
  if (!res.ok) {
    const m = body?.message;
    throw new ApiError(Array.isArray(m) ? m.join(", ") : m || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

/** Depth-first search for the first string value whose key matches. */
export function findKey(obj: any, re: RegExp, depth = 0): any {
  if (!obj || typeof obj !== "object" || depth > 5) return undefined;
  for (const [k, v] of Object.entries(obj)) {
    if (re.test(k) && v != null && typeof v !== "object") return v;
  }
  for (const v of Object.values(obj)) {
    const r = findKey(v, re, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

export function unwrap(x: any): any {
  let cur = x;
  while (cur && typeof cur === "object" && !Array.isArray(cur) && "data" in cur && cur.data != null)
    cur = cur.data;
  return cur;
}

/** All arrays of objects found (named), breadth-first. */
export function findArrays(obj: any, depth = 0, name = "items"): { name: string; items: any[] }[] {
  if (!obj || typeof obj !== "object" || depth > 3) return [];
  if (Array.isArray(obj)) return obj.length && typeof obj[0] === "object" ? [{ name, items: obj }] : [];
  return Object.entries(obj).flatMap(([k, v]) => findArrays(v, depth + 1, k));
}

export const firstArray = (x: any) => findArrays(unwrap(x))[0]?.items ?? [];

export const titleOf = (o: any): string =>
  o?.title ?? o?.name ?? o?.subject_name ?? o?.course_name ?? o?.section_name ?? o?.video_title ??
  o?.test_name ?? findKey(o, /(title|name)$/i) ?? "Untitled";

export const idOf = (o: any): string | undefined => {
  const v = o?.id ?? o?._id ?? o?.video_id ?? o?.videoId ?? o?.subject_id ?? o?.course_id ?? o?.test_id;
  return v == null ? undefined : String(v);
};

const IMG = /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i;
export function imageOf(o: any, depth = 0): string | undefined {
  if (!o || typeof o !== "object" || depth > 2) return undefined;
  for (const v of Object.values(o)) if (typeof v === "string" && IMG.test(v)) return v;
  for (const v of Object.values(o)) {
    const r = typeof v === "object" ? imageOf(v, depth + 1) : undefined;
    if (r) return r;
  }
  return undefined;
}

export function isVideoLike(o: any) {
  return Object.keys(o ?? {}).some((k) => /video|duration|lecture/i.test(k));
}

export const label = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
