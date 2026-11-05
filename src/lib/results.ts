import type { Question } from "./assessment";

export type AttemptResult = {
  id: string; kind: "test" | "qbank"; itemId: string; title: string; finishedAt: string;
  total: number; answered: number; correct: number; wrong: number; gradable: number;
  score: number | null; durationSec: number;
};

const KEY = "nprep_attempt_results";

// NORCET-style marking: +1 correct, 0 otherwise; score is a percentage of gradable questions.
export function scoreAttempt(questions: Question[], answers: Record<string, string>) {
  const answered = questions.filter((q) => answers[q.id] != null).length;
  const gradable = questions.filter((q) => q.correctId != null);
  const correct = gradable.filter((q) => answers[q.id] === q.correctId).length;
  const wrong = gradable.filter((q) => answers[q.id] != null && answers[q.id] !== q.correctId).length;
  return { total: questions.length, answered, correct, wrong, gradable: gradable.length, score: gradable.length ? Math.round((correct / gradable.length) * 100) : null };
}

export function loadResults(): AttemptResult[] {
  if (typeof window === "undefined") return [];
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function saveResult(result: AttemptResult) {
  const next = [result, ...loadResults()].slice(0, 100);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("nprep-results"));
}

export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(r).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Duration from NPrep fields (minutes) or one minute per question.
export function testDurationSec(item: any, questionCount: number): number {
  const raw = Number(item?.duration ?? item?.total_time ?? item?.time_limit ?? item?.duration_minutes);
  return raw > 0 ? raw * 60 : questionCount * 60;
}
