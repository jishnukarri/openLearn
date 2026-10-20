// Pure save-time validation for teacher-edited lessons. Returns plain-language
// problems with a `path` the editor uses to highlight the offending field
// (e.g. "sections.2.check.options.1"). Shared by the editor and the server.

import type { LessonContent } from "@/lib/ai/lessons";

export type LessonIssue = { path: string; message: string };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// "a, b\nc" -> ["a", "b", "c"]
export function splitAccepted(input: string): string[] {
  return input.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

export function sectionIndexOfPath(path: string): number {
  const m = /^sections\.(\d+)/.exec(path);
  return m ? Number(m[1]) : -1;
}

function validateCheck(check: unknown, base: string, n: number): LessonIssue[] {
  const issues: LessonIssue[] = [];
  const at = (suffix: string, message: string) =>
    issues.push({ path: `${base}${suffix}`, message: `Section ${n}: ${message}` });
  if (!check || typeof check !== "object") {
    at("", "add a quick check question.");
    return issues;
  }
  const c = check as Record<string, unknown>;
  if (!text(c.question)) at(".question", "the quick check needs a question.");
  const kind = c.kind ?? "mcq";

  const checkOptions = (): string[] | null => {
    const raw = Array.isArray(c.options) ? c.options : [];
    const options = raw.map((o) => text(o));
    if (options.length < 2) {
      at(".options", "the quick check needs at least 2 answer options.");
      return null;
    }
    let ok = true;
    const seen = new Map<string, number>();
    options.forEach((o, i) => {
      if (!o) {
        at(`.options.${i}`, `option ${i + 1} is empty. Fill it in or remove it.`);
        ok = false;
        return;
      }
      const key = o.toLowerCase();
      if (seen.has(key)) {
        at(`.options.${i}`, `options ${seen.get(key)! + 1} and ${i + 1} are the same. Each option must be different.`);
        ok = false;
      } else seen.set(key, i);
    });
    return ok ? options : options;
  };

  if (kind === "mcq") {
    const options = checkOptions();
    const idx = c.correctIndex;
    if (options && (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) >= options.length)) {
      at(".correctIndex", "choose which option is the correct answer.");
    }
  } else if (kind === "multi") {
    const options = checkOptions();
    const idxs = Array.isArray(c.correctIndexes) ? c.correctIndexes : [];
    if (!idxs.length) at(".correctIndexes", "tick at least one correct answer.");
    else if (options && idxs.some((i) => !Number.isInteger(i) || (i as number) < 0 || (i as number) >= options.length)) {
      at(".correctIndexes", "one of the correct answers no longer matches an option. Pick them again.");
    }
  } else if (kind === "short") {
    const accepted = (Array.isArray(c.accepted) ? c.accepted : [])
      .flatMap((a) => (typeof a === "string" ? splitAccepted(a) : []));
    if (!accepted.length) at(".accepted", "add at least one accepted answer.");
  } else if (kind === "matching") {
    const pairs = Array.isArray(c.pairs) ? c.pairs : [];
    if (pairs.length < 2) at(".pairs", "matching needs at least 2 pairs.");
    pairs.forEach((p, i) => {
      const pair = (p ?? {}) as Record<string, unknown>;
      if (!text(pair.left)) at(`.pairs.${i}.left`, `pair ${i + 1} is missing its left side.`);
      if (!text(pair.right)) at(`.pairs.${i}.right`, `pair ${i + 1} is missing its right side.`);
    });
  } else {
    at(".kind", "this quick check type isn't recognised.");
  }
  return issues;
}

export function validateLesson(content: unknown): LessonIssue[] {
  const lesson = content as Partial<LessonContent> | null;
  if (!lesson || !Array.isArray(lesson.sections) || lesson.sections.length === 0) {
    return [{ path: "sections", message: "The lesson needs at least one section." }];
  }
  const issues: LessonIssue[] = [];
  lesson.sections.forEach((s, i) => {
    const base = `sections.${i}`;
    const n = i + 1;
    if (!s || typeof s !== "object") {
      issues.push({ path: base, message: `Section ${n} is empty.` });
      return;
    }
    if (!text(s.heading)) issues.push({ path: `${base}.heading`, message: `Section ${n}: add a heading.` });
    if (!text(s.explanation)) issues.push({ path: `${base}.explanation`, message: `Section ${n}: add an explanation.` });
    if (!text(s.example)) issues.push({ path: `${base}.example`, message: `Section ${n}: add a worked example.` });
    issues.push(...validateCheck(s.check, `${base}.check`, n));
  });
  return issues;
}
