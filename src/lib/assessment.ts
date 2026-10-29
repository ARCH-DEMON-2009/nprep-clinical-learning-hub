import { idOf, unwrap } from "./api";

export type Question = { id: string; text: string; options: { id: string; text: string; correct?: boolean }[]; correctId?: string | undefined; explanation?: string | undefined };

export function findEntity(response: any, id: string, depth = 0): any {
  if (!response || typeof response !== "object" || depth > 8) return undefined;
  if (!Array.isArray(response) && idOf(response) === id) return response;
  for (const child of Object.values(response)) {
    const found = findEntity(child, id, depth + 1);
    if (found) return found;
  }
}

export function questionList(response: any): Question[] {
  const root = unwrap(response);
  const raw = Array.isArray(root) ? root : root?.questions ?? root?.question_list ?? root?.mcqs ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((q, i) => {
    const text = q?.question ?? q?.question_text ?? q?.stem;
    const options = q?.options ?? q?.answers ?? q?.choices;
    if (typeof text !== "string" || !Array.isArray(options)) return [];
    const normalized = options.flatMap((o: any, j: number) => {
      const label = typeof o === "string" ? o : o?.text ?? o?.option ?? o?.option_text ?? o?.answer;
      return typeof label === "string" ? [{ id: String(o?.id ?? o?.option_id ?? j), text: label, correct: o?.is_correct === true }] : [];
    });
    if (!normalized.length) return [];
    const explicit = q?.correct_option_id ?? q?.correct_answer_id;
    const correctId = explicit != null ? String(explicit) : normalized.find((o) => o.correct)?.id;
    return [{ id: String(q?.id ?? q?.question_id ?? i), text, options: normalized, correctId, explanation: typeof q?.explanation === "string" ? q.explanation : undefined }];
  });
}

// Follow only question URLs actually supplied by NPrep, never invented endpoints.
export function questionPath(entity: any): string | undefined {
  const value = entity?.questions_url ?? entity?.question_url ?? entity?.practice_url ?? entity?.links?.questions;
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value, "https://api.nprep.in");
    if (url.origin !== "https://api.nprep.in" || !/^\/v3\/(qbank|test)(\/|\?|$)/.test(url.pathname)) return undefined;
    return url.pathname.slice(3) + url.search;
  } catch { return undefined; }
}

export function assessmentChildren(entity: any): any[] {
  for (const key of ["all_tests", "exams", "tests", "chapters", "topics", "modules", "sections"]) {
    if (Array.isArray(entity?.[key])) return entity[key];
  }
  return [];
}