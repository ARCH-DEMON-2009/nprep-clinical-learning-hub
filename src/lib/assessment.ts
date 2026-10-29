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
  const normalize = (raw: any[]): Question[] => raw.flatMap((q, i) => {
    const text = q?.question ?? q?.question_text ?? q?.questionText ?? q?.question_body ?? q?.question_title ?? q?.questionTitle ?? q?.stem ?? q?.text;
    let rawOptions = q?.options ?? q?.answers ?? q?.choices ?? q?.answer_options ?? q?.answerOptions ?? q?.option_list;
    if (typeof rawOptions === "string") {
      try { rawOptions = JSON.parse(rawOptions); } catch {}
    }
    if (rawOptions == null && q && typeof q === "object") {
      rawOptions = Object.entries(q)
        .filter(([key, value]) => typeof value === "string" && /^option_?[a-f]$/i.test(key))
        .map(([id, value]) => ({ id: id.replace(/^option_?/i, ""), text: value }));
    }
    const options = Array.isArray(rawOptions)
      ? rawOptions
      : rawOptions && typeof rawOptions === "object" ? Object.entries(rawOptions).map(([id, value]) => ({ id, text: value })) : [];
    if (typeof text !== "string" || !options.length) return [];
    const normalized = options.flatMap((o: any, j: number) => {
      const label = typeof o === "string" ? o : o?.text ?? o?.option ?? o?.option_text ?? o?.optionText ?? o?.answer ?? o?.label;
      return typeof label === "string" ? [{ id: String(o?.id ?? o?.option_id ?? j), text: label, correct: o?.is_correct === true || o?.isCorrect === true }] : [];
    });
    if (!normalized.length) return [];
    const explicit = q?.correct_option_id ?? q?.correctOptionId ?? q?.correct_answer_id ?? q?.answer_id;
    const correctId = explicit != null ? String(explicit) : normalized.find((o) => o.correct)?.id;
    return [{ id: String(q?.id ?? q?.question_id ?? q?.questionId ?? i), text, options: normalized, correctId, explanation: typeof q?.explanation === "string" ? q.explanation : undefined }];
  });

  const visit = (value: any, depth = 0): Question[] => {
    if (depth > 8 || value == null) return [];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try { return visit(JSON.parse(trimmed), depth + 1); } catch {}
      }
      return [];
    }
    if (typeof value !== "object") return [];
    if (Array.isArray(value)) {
      const direct = normalize(value);
      if (direct.length) return direct;
      for (const child of value) {
        const found = visit(child, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    for (const [key, child] of Object.entries(value)) {
      if (/(^questions?$|question_list|mcqs|^qs$)/i.test(key) && Array.isArray(child)) {
        const direct = normalize(child);
        if (direct.length) return direct;
      }
    }
    const single = normalize([value]);
    if (single.length) return single;
    for (const child of Object.values(value)) {
      const found = visit(child, depth + 1);
      if (found.length) return found;
    }
    return [];
  };

  return visit(root);
}

// Follow only question URLs actually supplied by NPrep, never invented endpoints.
export function questionPath(entity: any): string | undefined {
  const candidates: { key: string; value: string }[] = [];
  const visit = (value: any, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 8) return;
    if (Array.isArray(value)) return value.forEach((child) => visit(child, depth + 1));
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && /question|practice|endpoint|href|^url$|share_?link|^(?:test|subject|qbank)_url$/i.test(key)) candidates.push({ key, value: child });
      else if (child && typeof child === "object") visit(child, depth + 1);
    }
  };
  visit(entity);

  for (const { key, value } of candidates) {
    try {
      const url = new URL(value, "https://api.nprep.in/v3/");
      if (url.origin !== "https://api.nprep.in") continue;
      const path = url.pathname.startsWith("/v3/")
        ? url.pathname
        : /^\/(?:qbank|test)(?:\/|$)/.test(url.pathname) ? `/v3${url.pathname}` : url.pathname;
      const match = path.match(/^\/v3(\/.*)$/);
      if (!match) continue;
      const questionRoute = /question|practice|mcq|^(?:test|subject|qbank)_url$/i.test(key) || /question|practice|mcq/i.test(path);
      const assessmentRoute = /^\/v3\/(?:qbank|test|assessment|questions?)(?:\/|$)/i.test(path);
      if (!questionRoute || !assessmentRoute) continue;
      return match[1] + url.search;
    } catch {}
  }
  return undefined;
}

export function assessmentDiagnostics(response: unknown): string {
  const fields: string[] = [];
  const visit = (value: any, path = "response", depth = 0) => {
    if (depth > 6 || value == null) return;
    if (Array.isArray(value)) {
      fields.push(`${path}: array(${value.length})`);
      value.slice(0, 3).forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1));
      return;
    }
    if (typeof value !== "object") {
      fields.push(`${path}: ${typeof value}`);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (/question|option|answer|test|subject|qbank|assessment|exam|link|url|data|result|item|selected|fetched/i.test(key) || (child && typeof child === "object")) {
        visit(child, `${path}.${key}`, depth + 1);
      }
    }
    if (depth === 0 && fields.length === 0) fields.push(`top-level keys: ${Object.keys(value).join(", ") || "none"}`);
  };
  visit(response);
  return fields.slice(0, 40).join("\n") || "No question, link, or assessment fields were returned.";
}

export function assessmentShareLink(response: unknown): string | undefined {
  const visit = (value: any, depth = 0): string | undefined => {
    if (!value || typeof value !== "object" || depth > 8) return undefined;
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = visit(child, depth + 1);
        if (found) return found;
      }
      return undefined;
    }
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && /share_?link|share_?url/i.test(key)) {
        try {
          const url = new URL(child, "https://nprep.in");
          if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) {
            if (url.protocol === "http:" && /(^|\.)nprep\.in$/i.test(url.hostname)) url.protocol = "https:";
            return url.toString();
          }
        } catch {}
      }
      if (child && typeof child === "object") {
        const found = visit(child, depth + 1);
        if (found) return found;
      }
    }
    return undefined;
  };
  return visit(response);
}

export function assessmentQuestionCount(response: unknown): number | undefined {
  const visit = (value: any, depth = 0): number | undefined => {
    if (!value || typeof value !== "object" || depth > 8) return undefined;
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = visit(child, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    for (const [key, child] of Object.entries(value)) {
      if (/^(total_?)?questions(_count)?$/i.test(key)) {
        const count = Number(child);
        if (Number.isFinite(count) && count >= 0) return count;
      }
    }
    for (const child of Object.values(value)) {
      const found = visit(child, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return visit(response);
}

export function assessmentQuestionSource(catalog: any, id: string, fallback: any): { entity: any; path?: string } {
  const entity = findEntity(catalog, id) ?? fallback;
  const path = questionPath(entity);
  return path ? { entity, path } : { entity };
}

export function assessmentChildren(entity: any): any[] {
  const keys = ["all_tests", "exams", "tests", "chapters", "topics", "modules", "sections", "question_sets", "question_papers"];
  const visit = (value: any, depth = 0): any[] => {
    if (!value || typeof value !== "object" || depth > 6) return [];
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    for (const key of keys) if (Array.isArray(value[key])) return value[key];
    for (const child of Object.values(value)) {
      const found = visit(child, depth + 1);
      if (found.length) return found;
    }
    return [];
  };
  return visit(unwrap(entity));
}