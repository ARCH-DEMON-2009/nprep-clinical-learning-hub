const TOKEN_KEY = "nprep_token";
const BASE = "/api/nprep/v3";

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function syncSupabaseUser(mobile: string, payload: { auth?: unknown; profile?: unknown; raw?: unknown }) {
  const response = await fetch("/api/users/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mobile, ...payload }),
  });
  if (!response.ok) throw new Error(await response.text());
}

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

export function contentArrays(x: any, depth = 0): { key: string; items: any[] }[] {
  const root = depth === 0 ? unwrap(x) : x;
  if (!root || typeof root !== "object" || depth > 8) return [];
  if (Array.isArray(root)) {
    const objects = root.filter((item) => item && typeof item === "object");
    return objects.length ? [{ key: "items", items: objects }, ...objects.flatMap((item) => contentArrays(item, depth + 1))] : [];
  }
  return Object.entries(root).flatMap(([key, value]) => {
    const nested = contentArrays(value, depth + 1);
    if (Array.isArray(value)) {
      const objects = value.filter((item) => item && typeof item === "object");
      return objects.length ? [{ key, items: objects }, ...nested] : nested;
    }
    return nested;
  });
}

export function firstArray(x: any): any[] {
  const collections = contentArrays(x);
  if (!collections.length) return [];
  const score = ({ key, items }: { key: string; items: any[] }) => {
    const keyScore = /(courses?|subjects?|batches?|sections?|lectures?|videos?|contents?|modules?|rapid)/i.test(key) ? 100 : 0;
    const titleScore = items.filter((item) => Object.keys(item).some((name) => /(title|name)$/i.test(name))).length;
    const idScore = items.filter((item) => idOf(item)).length;
    return keyScore + titleScore * 4 + idScore * 2 + Math.min(items.length, 30);
  };
  const ranked = collections.filter(({ items }) => items.some((item) => Object.keys(item).length)).sort((a, b) => score(b) - score(a));
  const top = ranked[0];
  if (!top) return [];
  if (/courses?|subjects?|batches?|sections?|lectures?|videos?|contents?|modules?|rapid/i.test(top.key)) {
    const ids = new Map<string, any>();
    for (const collection of ranked) {
      if (collection.key !== top.key && !/(courses?|subjects?|batches?|sections?|lectures?|videos?|contents?|modules?|rapid)/i.test(collection.key)) continue;
      for (const item of collection.items) {
        const id = idOf(item);
        if (id) ids.set(id, item);
      }
    }
    if (ids.size > 0) return [...ids.values()];
  }
  return top.items.filter((item, index, items) => items.findIndex((candidate) => idOf(candidate) === idOf(item) || candidate === item) === index);
}

export const titleOf = (o: any): string =>
  o?.title ?? o?.name ?? o?.subject_name ?? o?.course_name ?? o?.batch_name ?? o?.batchName ??
  o?.section_name ?? o?.video_title ?? o?.test_name ?? o?.subjectName ?? o?.courseName ??
  o?.batchTitle ?? findKey(o, /(title|name)$/i) ?? "Untitled";

export const idOf = (o: any): string | undefined => {
  const v = o?.id ?? o?._id ?? o?.subjectId ?? o?.subject_id ?? o?.courseId ?? o?.course_id ??
    o?.batchId ?? o?.batch_id ?? o?.videoId ?? o?.video_id ?? o?.lectureId ?? o?.lecture_id ??
    o?.sectionId ?? o?.section_id ?? o?.test_id ?? findKey(o, /^(id|.*_id)$/i);
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

const hasTitle = (o: any) =>
  o && typeof o === "object" && Object.keys(o).some((k) => /(title|name)$/i.test(k) && typeof o[k] === "string");

/** Best list of real entities: flattens group wrappers (e.g. [{category, subjects:[...]}]). */
export function pickList(x: any, depth = 0): any[] {
  if (!x || typeof x !== "object" || depth > 5) return [];
  if (Array.isArray(x)) {
    const objs = x.filter((o) => o && typeof o === "object");
    if (objs.length && objs.filter(hasTitle).length >= objs.length / 2) return objs;
    const nested = objs.flatMap((o) => pickList(o, depth + 1));
    return nested.length ? nested : objs;
  }
  let best: any[] = [];
  for (const v of Object.values(x)) {
    const r = pickList(v, depth + 1);
    if (r.filter(hasTitle).length > best.filter(hasTitle).length) best = r;
  }
  return best;
}

/** Question count under any common key name. */
export function questionCount(o: any): number | undefined {
  if (!o || typeof o !== "object") return undefined;
  for (const [k, v] of Object.entries(o)) {
    if (/(question|ques|_qs$|^qs$|mcq)/i.test(k) && !/(attempt|solved|complet|correct|wrong|skip)/i.test(k)) {
      const n = Number(Array.isArray(v) ? v.length : v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}
