import { contentArrays, idOf, titleOf, unwrap } from "./api";

export type CatalogKind = "batch" | "course" | "subject";
const names = { batch: /^(?:user_|my_|active_|all_)?(?:batches|editions)$/i, course: /^(?:all_|my_)?courses$/i, subject: /^(?:all_)?subjects$/i };

export function uniqueEntities(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item || typeof item !== "object" || titleOf(item) === "Untitled") return false;
    const key = `${idOf(item) ?? titleOf(item)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/** Preserve hierarchy: never merge a subject's courses into the subject list. */
export function catalogEntities(value: any, kind: CatalogKind, allowRoot = false): any[] {
  const root = unwrap(value);
  const walk = (node: any, depth: number): any[] => {
    if (!node || typeof node !== "object" || depth > 8) return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, depth + 1));
    return Object.entries(node).flatMap(([key, child]) =>
      names[kind].test(key) && Array.isArray(child) ? child : walk(child, depth + 1));
  };
  const named = uniqueEntities(walk(root, 0));
  return named.length ? named : allowRoot && Array.isArray(root) ? uniqueEntities(root) : [];
}

export function lectureRows(section: any): any[] {
  const walk = (node: any, depth = 0): any[] => {
    if (!node || typeof node !== "object" || depth > 8) return [];
    if (Array.isArray(node)) return node.flatMap((item) => walk(item, depth + 1));
    return Object.entries(node).flatMap(([key, child]) => {
      if (/sections?|chapters?|stamps|notes|faculty|teachers?/i.test(key)) return [];
      if (/^(?:all_)?(?:videos?|lectures?|contents?|items|sk_texts?)$/i.test(key) && Array.isArray(child))
        return child.filter((item) => item && typeof item === "object" && idOf(item) && titleOf(item) !== "Untitled");
      return walk(child, depth + 1);
    });
  };
  return uniqueEntities(walk(section));
}

export function sectionGroups(value: any): any[] {
  const root = unwrap(value);
  const named = contentArrays(root).filter(({ key }) => /^(?:all_)?sections$/i.test(key)).flatMap(({ items }) => items);
  const sections = uniqueEntities(named.length ? named : Array.isArray(root) ? root : []);
  const playable = sections.filter((section) => lectureRows(section).length > 0);
  if (playable.length) return playable;
  const videos = lectureRows(root);
  return videos.length ? [{ name: "Lectures", videos }] : sections;
}

export function lectureCompleted(video: any): boolean {
  const watched = Number(video?.watch_time), duration = Number(video?.time ?? video?.duration);
  return Boolean(video?.is_completed || video?.completed) || (duration > 0 && watched >= duration * 0.9);
}

export function filterSectionLectures(section: any, term: string, mode: "all" | "free" | "completed") {
  const videos = lectureRows(section);
  const query = term.trim().toLowerCase();
  const sectionMatches = String(titleOf(section)).toLowerCase().includes(query);
  const kept = videos.filter((video) => (!query || sectionMatches || String(titleOf(video)).toLowerCase().includes(query))
    && (mode !== "free" || video.is_free === true || video.is_free === 1)
    && (mode !== "completed" || lectureCompleted(video)));
  return { section, videos: kept, total: videos.length };
}

export function recentLectures(value: any): any[] {
  return uniqueEntities(contentArrays(value).filter(({ key }) => /recent|resume|continue|last_watched/i.test(key)).flatMap(({ items }) => items));
}

export function dailyStats(value: any): { label: string; value: string }[] {
  const root = unwrap(value);
  const node = root?.daily_stats ?? root?.today_stats ?? root?.stats?.today;
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).filter(([, value]) => typeof value === "number" || typeof value === "string")
    .map(([key, value]) => ({ label: key.replace(/_/g, " "), value: String(value) }));
}