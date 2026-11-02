import type { LessonCheck, LessonSection } from "@/lib/ai/lessons";
import { COACH_MISS_LIMIT } from "./lesson-misses";
import type { Step } from "@/app/learn/[topicId]/lesson-plan";

// Pure helpers that decide what the AI coach is allowed to know. The coach
// only ever receives lesson material up to and including the student's
// current step: later steps are never serialised, so they cannot leak.

export const COACH_SCOPE_RULE =
  "The student may ask about anything in this topic or subject, including parts of the lesson they have not reached yet. Answer it directly at GCSE level; never say it comes later. Knowing more is good for revision.";

const MAX_STEPS = 80;
const MAX_TEXT = 700;
const MAX_CONTEXT_CHARS = 6000;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ── Plan validation ────────────────────────────────────────────────────────
// The client sends only the plan's shape. It is validated against the stored
// lesson, so a tampered plan cannot name sections that do not exist.
export function sanitizePlan(raw: unknown, sectionCount: number): Step[] {
  if (!Array.isArray(raw)) return [];
  const out: Step[] = [];
  const idx = (v: unknown) => {
    const n = Number((v as { sectionIndex?: unknown })?.sectionIndex);
    return Number.isInteger(n) && n >= 0 && n < sectionCount ? n : null;
  };
  for (const s of raw.slice(0, MAX_STEPS)) {
    const phase = (s as { phase?: unknown } | null)?.phase;
    if (phase === "teach" || phase === "check" || phase === "tutor") {
      const n = idx(s);
      if (n !== null) out.push({ phase, sectionIndex: n });
    } else if (phase === "flashcard") {
      const ci = (s as { cardIndices?: unknown }).cardIndices;
      const cards = Array.isArray(ci)
        ? ci.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < sectionCount).slice(0, 4)
        : [];
      out.push({ phase: "flashcard", cardIndices: cards });
    } else if (phase === "hook" || phase === "practice" || phase === "recap" || phase === "done") {
      out.push({ phase });
    } else if (phase === "interactive") {
      out.push({ phase, role: (s as { role?: unknown }).role === "explore" ? "explore" : "consolidate" });
    }
  }
  return out;
}

export function clampIndex(index: unknown, total: number): number {
  const n = Math.round(Number(index));
  if (!Number.isFinite(n) || total <= 0) return 0;
  return Math.max(0, Math.min(n, total - 1));
}

// ── Covered lesson context ─────────────────────────────────────────────────
export type CoachContext = {
  text: string;
  currentStep: string; // just the step on screen, answer withheld
  coveredTopics: string[];
  stepNumber: number; // 1-based, for "Knows up to step N"
};

function checkLine(check: LessonCheck, revealAnswer: boolean): string {
  const q = clip(check.question, 300);
  if (!revealAnswer) return `Check question (answer withheld): ${q}`;
  switch (check.kind) {
    case "short":
      return `Check question: ${q} Answer: ${clip(check.accepted[0] ?? "", 120)}`;
    case "multi":
      return `Check question: ${q} Answer: ${check.correctIndexes.map((i) => check.options[i]).join("; ")}`;
    case "matching":
      return `Check question: ${q} Pairs: ${check.pairs.map((p) => `${p.left}=${p.right}`).join("; ")}`;
    default:
      return `Check question: ${q} Answer: ${check.options[check.correctIndex] ?? ""}`;
  }
}

export function buildCoachContext(input: {
  plan: Step[];
  sections: LessonSection[];
  hook?: string | null;
  stepIndex: number;
}): CoachContext {
  const { plan, sections } = input;
  const cur = clampIndex(input.stepIndex, plan.length);
  const parts: string[] = [];
  const covered: string[] = [];
  const seen = new Set<number>();

  for (let i = 0; i <= cur && i < plan.length; i++) {
    const step = plan[i];
    if (step.phase === "hook" && input.hook) {
      parts.push(`Opening challenge: ${clip(input.hook, 300)}`);
    } else if (step.phase === "teach") {
      const sec = sections[step.sectionIndex];
      if (!sec || seen.has(step.sectionIndex)) continue;
      seen.add(step.sectionIndex);
      covered.push(sec.heading);
      parts.push(
        `Section ${step.sectionIndex + 1}: ${sec.heading}\n${clip(sec.explanation, MAX_TEXT)}\nWorked example: ${clip(sec.example, MAX_TEXT)}`
      );
    } else if (step.phase === "check" || step.phase === "tutor") {
      const sec = sections[step.sectionIndex];
      if (!sec) continue;
      // The question on screen right now never has its answer revealed.
      parts.push(`${step.phase === "tutor" ? "Written question" : `Section ${step.sectionIndex + 1}`}: ${checkLine(sec.check, i < cur)}`);
    }
  }

  // Only teach steps at or before the current one are listed, so a revisited
  // earlier step never exposes later sections.
  const text = clip(parts.join("\n\n"), MAX_CONTEXT_CHARS) ||
    "The student has not reached any teaching yet.";
  return { text, currentStep: describeStep(input, cur), coveredTopics: covered, stepNumber: cur + 1 };
}

// What is on screen at step `cur`. A check or written question never has its
// answer revealed here.
function describeStep(
  input: { plan: Step[]; sections: LessonSection[]; hook?: string | null },
  cur: number
): string {
  const step = input.plan[cur];
  if (!step) return "Nothing yet.";
  if (step.phase === "hook") return input.hook ? `Opening challenge: ${clip(input.hook, 300)}` : "Opening of the lesson.";
  const sec = "sectionIndex" in step ? input.sections[step.sectionIndex] : undefined;
  if (step.phase === "teach" && sec) {
    return `Section ${step.sectionIndex + 1}: ${sec.heading}\n${clip(sec.explanation, MAX_TEXT)}\nWorked example: ${clip(sec.example, MAX_TEXT)}`;
  }
  if ((step.phase === "check" || step.phase === "tutor") && sec) {
    return `Check question the student has not answered yet (never reveal its answer): ${checkLine(sec.check, false).replace(/^Check question \(answer withheld\): /, "")}`;
  }
  return `A "${step.phase}" step.`;
}

// The whole lesson as reference text, in a fixed order, with every check
// answer left out. Identical on every turn of a lesson, so it can sit in a
// cached prompt prefix. Nothing per-turn may ever go in here.
export function buildLessonReference(sections: LessonSection[], hook?: string | null): string {
  const parts: string[] = [];
  if (hook) parts.push(`Opening challenge: ${clip(hook, 300)}`);
  sections.forEach((sec, i) => {
    parts.push(
      `Section ${i + 1}: ${sec.heading}\n${clip(sec.explanation, 1500)}\nWorked example: ${clip(sec.example, 1500)}`
    );
  });
  return parts.join("\n\n");
}

// ── Student session record (client tracked, tiny) ─────────────────────────
export type CoachSession = {
  answers: { section: number; correct: boolean; picked?: string; tries: number }[];
  hints: number;
  revisits: number;
};

export function sanitizeSession(raw: unknown, sectionCount: number): CoachSession {
  const r = (raw ?? {}) as Partial<CoachSession>;
  const answers = Array.isArray(r.answers) ? r.answers.slice(0, 40) : [];
  const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v)) || 0));
  return {
    answers: answers
      .map((a) => ({
        section: Math.round(Number(a?.section)),
        correct: a?.correct === true,
        picked: typeof a?.picked === "string" ? a.picked.slice(0, 120) : undefined,
        tries: Math.max(1, num(a?.tries, 9)),
      }))
      .filter((a) => Number.isInteger(a.section) && a.section >= 0 && a.section < sectionCount),
    hints: num(r.hints, 99),
    revisits: num(r.revisits, 99),
  };
}

export function summarizeSession(session: CoachSession, sections: LessonSection[], coveredSections: Set<number>): string {
  const lines: string[] = [];
  const wrong: string[] = [];
  const right: string[] = [];
  for (const a of session.answers) {
    if (!coveredSections.has(a.section)) continue; // never mention uncovered sections
    const h = sections[a.section]?.heading ?? `section ${a.section + 1}`;
    if (!a.correct) wrong.push(`${h}${a.picked ? ` (picked "${a.picked}")` : ""}`);
    else right.push(a.tries > 1 ? `${h} (after ${a.tries} tries)` : h);
  }
  if (wrong.length) lines.push(`Got wrong so far: ${wrong.join("; ")}.`);
  if (right.length) lines.push(`Got right: ${right.join("; ")}.`);
  if (session.hints) lines.push(`Hints used: ${session.hints}.`);
  if (session.revisits) lines.push(`Steps revisited: ${session.revisits}.`);
  return lines.join(" ");
}

// Questions the student asked earlier in this chat that have dropped out of
// the short transcript window, so the coach still knows what they were unsure of.
export function summarizeAskedQuestions(history: { role: string; text: string }[], windowSize = 6): string {
  const older = history.slice(0, Math.max(0, history.length - windowSize)).filter((h) => h.role === "student");
  if (!older.length) return "";
  return `Earlier questions they asked (what they were unsure about): ${older.slice(-5).map((h) => `"${clip(h.text, 80)}"`).join("; ")}.`;
}

// ── Topic history (server fetched) ─────────────────────────────────────────
export type TopicHistory = {
  weakAreas: string[];
  recentLow: { prompt: string; marks: number; max: number }[];
  // Top unresolved lesson check misses (this lesson and the ones before it).
  lessonMisses?: { prompt: string; lessonLabel: string }[];
};

const HISTORY_CHAR_CAP = 2400; // roughly 600 tokens

export function summarizeHistory(h: TopicHistory | null): string {
  if (!h) return "";
  const lines: string[] = [];
  if (h.weakAreas.length) lines.push(`Weak areas on record: ${h.weakAreas.slice(0, 4).map((w) => clip(w, 60)).join("; ")}.`);
  if (h.recentLow.length) {
    lines.push(
      `Recent low-mark answers: ${h.recentLow
        .slice(0, 4)
        .map((a) => `"${clip(a.prompt, 90)}" ${a.marks}/${a.max}`)
        .join("; ")}.`
    );
  }
  if (h.lessonMisses?.length) {
    lines.push(
      `Lesson check questions they missed and have not yet got right: ${h.lessonMisses
        .slice(0, COACH_MISS_LIMIT)
        .map((m) => `"${clip(m.prompt, 90)}" (${clip(m.lessonLabel, 40)})`)
        .join("; ")}.`
    );
  }
  return clip(lines.join(" "), HISTORY_CHAR_CAP);
}

// Sections the student has reached the teaching of, from the plan.
export function coveredSectionSet(plan: Step[], stepIndex: number): Set<number> {
  const cur = clampIndex(stepIndex, plan.length);
  const out = new Set<number>();
  for (let i = 0; i <= cur; i++) {
    const s = plan[i];
    if (s?.phase === "teach") out.add(s.sectionIndex);
  }
  return out;
}
