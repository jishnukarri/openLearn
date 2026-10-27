// Pure prompt builders, JSON extraction and validation for AI hints and
// remediation (scaffold / explain). No network and no server-only imports so
// everything here is unit-testable. The model call lives in remediation.ts.
import { hintIsSafe, hintSimilarity } from "../question-hints";
import { answersMatch, markNumeric, parseNumericAnswer } from "../question-marking";
import { parseScene } from "../lesson-scene";
import { WORKED_EXAMPLE_GUIDE } from "./scene-prompt";
import type { QuestionFormat } from "./questions";
import type { Remediation, ScaffoldStep, TransferCheck } from "../question-remediation";

export type RemediationInput = {
  prompt: string;
  markscheme: { point: string }[];
  maxMarks: number;
  modelAnswer: string;
  format?: QuestionFormat | null;
  topicTitle?: string | null;
};

export type Validated<T> = ({ ok: true } & T) | { ok: false; reason: string };

/* ── JSON ─────────────────────────────────────────────────────────────── */

// Tolerates code fences and surrounding prose. Unlike scene extractJson it
// never unwraps keys.
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let body = (fenced ? fenced[1] : text).trim();
  if (!body.startsWith("{")) {
    const a = body.indexOf("{");
    const b = body.lastIndexOf("}");
    if (a >= 0 && b > a) body = body.slice(a, b + 1);
  }
  return JSON.parse(body);
}

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/* ── answers the learner must not be handed ───────────────────────────── */

export function hintSecrets(input: RemediationInput): string[] {
  const f = input.format;
  const out: string[] = [];
  if (f?.type === "short-answer") out.push(...f.accepted);
  if (f?.type === "calculation" || f?.type === "numeric") out.push(f.answer);
  if (f?.type === "multiple-choice") {
    for (const i of f.correctIndexes) if (f.options[i]) out.push(f.options[i]);
  }
  // A short model answer is the answer itself.
  const model = input.modelAnswer.trim();
  if (model && model.length <= 40) out.push(model);
  return out.map((s) => s.trim()).filter(Boolean);
}

function schemePoints(input: RemediationInput): string[] {
  const f = input.format;
  if (f?.type === "multiple-choice" || f?.type === "matching") return [];
  const pts = input.markscheme.map((m) => m.point);
  if (f?.type === "structured") pts.push(...f.parts.flatMap((p) => p.markscheme.map((m) => m.point)));
  return pts;
}

function describeQuestion(input: RemediationInput): string {
  const f = input.format;
  let extra = "";
  if (f?.type === "multiple-choice") extra = `\nOptions:\n${f.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
  return (
    `Question (${input.maxMarks} mark${input.maxMarks === 1 ? "" : "s"}): ${input.prompt}${extra}\n` +
    (input.topicTitle ? `Topic: ${input.topicTitle}\n` : "") +
    `Model answer (SECRET, never reveal): ${input.modelAnswer}\n` +
    `Mark scheme (SECRET, never quote): ${input.markscheme.map((m) => m.point).join(" | ")}`
  );
}

/* ── HINTS ────────────────────────────────────────────────────────────── */

export const HINTS_SYSTEM_PROMPT =
  `You help a GCSE student who is stuck on an exam question. Write exactly 3 ` +
  `graduated hints in plain, friendly language a 15-year-old understands. Each ` +
  `is one or two short sentences.\n` +
  `Hint 1: point to the relevant idea or topic and what the question is really asking.\n` +
  `Hint 2: narrow to the key relationship or method. For science: "think about ` +
  `what happens to X when Y changes". For calculations: name the formula or equation to use.\n` +
  `Hint 3: give the first concrete step, or a worked parallel example with DIFFERENT numbers.\n` +
  `NEVER give the final answer, the numeric answer, an accepted answer, or a ` +
  `mark-scheme point word for word. Never write fill-in-the-blank hints or hints ` +
  `about letter counts. Reply with ONLY JSON: {"hints":["...","...","..."]}`;

export function buildHintsPrompt(input: RemediationInput): string {
  return `${describeQuestion(input)}\n\nReturn the JSON now.`;
}

export function buildRetryPrompt(reason: string, what: string): string {
  return `Your previous reply was rejected: ${reason}. Reply again with ONLY the corrected ${what} JSON.`;
}

export function validateHints(raw: unknown, input: RemediationInput): Validated<{ hints: string[] }> {
  const arr = raw && typeof raw === "object" ? (raw as { hints?: unknown }).hints : undefined;
  if (!Array.isArray(arr) || arr.length !== 3) return { ok: false, reason: 'need exactly 3 hints in {"hints":[...]}' };
  const hints: string[] = [];
  const secrets = hintSecrets(input);
  const points = schemePoints(input);
  for (let i = 0; i < 3; i++) {
    const h = arr[i];
    if (typeof h !== "string") return { ok: false, reason: `hint ${i + 1} is not text` };
    const t = h.trim();
    if (t.length < 15 || t.length > 400) return { ok: false, reason: `hint ${i + 1} must be 15-400 characters` };
    if (t.includes("…")) return { ok: false, reason: `hint ${i + 1} must not use blanks` };
    if (!hintIsSafe(t, points, secrets)) {
      return { ok: false, reason: `hint ${i + 1} gives away the answer or copies the mark scheme; make it less specific` };
    }
    hints.push(t);
  }
  return { ok: true, hints };
}

/* ── REMEDIATION ──────────────────────────────────────────────────────── */

export type FinalTarget =
  | { kind: "numeric"; value: number; tolerancePercent: number }
  | { kind: "loose"; values: number[] }
  | { kind: "text"; accepted: string[] };

function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.replace(/,(?=\d{3})/g, "").matchAll(/-?\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  return out;
}

// What the last scaffold step has to equal; null = no machine-checkable answer.
export function finalAnswerTarget(input: RemediationInput): FinalTarget | null {
  const f = input.format;
  if (f?.type === "numeric" || f?.type === "calculation") {
    const p = parseNumericAnswer(f.answer);
    if (p) {
      return {
        kind: "numeric",
        value: p.value,
        tolerancePercent: f.type === "numeric" ? Math.max(1, f.tolerancePercent ?? 1) : 1,
      };
    }
  }
  if (f?.type === "multiple-choice" || f?.type === "matching") return null;
  const values = numbersIn(input.modelAnswer);
  return values.length ? { kind: "loose", values } : null;
}

const MATHS_PROMPT = /\b(calculate|work out|determine the (?:value|mean|area|volume|speed)|solve|simplify|expand|factorise|evaluate|find the (?:mean|median|mode|range|area|volume|value|gradient)|what is the (?:mean|median|mode|range|area|volume|speed|probability))\b/i;

export function remediationKind(input: RemediationInput): "scaffold" | "explain" {
  const f = input.format;
  if (f?.type === "multiple-choice" || f?.type === "matching" || f?.type === "short-answer") return "explain";
  const target = finalAnswerTarget(input);
  if (!target) return "explain";
  if (f?.type === "numeric" || f?.type === "calculation") return "scaffold";
  return MATHS_PROMPT.test(input.prompt) && /\d/.test(input.prompt) ? "scaffold" : "explain";
}

const SCAFFOLD_SYSTEM =
  `You turn a GCSE calculation question into a SCAFFOLD: 3 to 5 graded sub-questions ` +
  `a stuck student answers one at a time. Each step feeds the next, and the LAST ` +
  `step is the original question's answer. Example for a mean: sum of the values, ` +
  `then number of values, then "mean = sum / count" as a fraction, then do the division.\n` +
  `Reply with ONLY JSON: {"steps":[{"prompt":"...","kind":"numeric"|"text"|"fraction",` +
  `"answer":..., "unit":"optional","tolerancePercent":optional,"accepted":["optional alternatives"],` +
  `"hint":"short nudge shown after a wrong try, never the answer"}]}\n` +
  `Rules: numeric answers are numbers (no units in answer; put the unit in "unit"). ` +
  `"fraction" steps have two boxes (top/bottom) and answer "top/bottom". "text" answers are ` +
  `a short exact word or phrase. Every step needs ONE exact machine-checkable answer. ` +
  `Use plain language and the question's own numbers. Steps before the last must not ` +
  `contain the final answer. The last step must ask for the original answer. ` +
  `A later step's prompt may insert the student's earlier answer with {1}, {2}... ` +
  `(1-based step number), e.g. "Work out {1} divided by {2}" — use this so each step ` +
  `visibly builds on the last.`;

const EXPLAIN_SYSTEM =
  `You help a GCSE student who got a question wrong twice. Write a short teaching card on ` +
  `the underlying concept, then a transfer check: a FRESH question on the same concept in a ` +
  `different format or context (not the original question reworded).\n` +
  `Reply with ONLY JSON: {"content":"70-110 words, plain language, one worked idea, markdown allowed",` +
  `"scene": optional annotated diagram (omit if unsure),` +
  `"transferCheck":{"prompt":"...","kind":"mcq","options":[4 options],"correctIndex":0-3}` +
  ` OR {"prompt":"...","kind":"short","accepted":["answer","alternative"]}}\n` +
  `Short answers must be one or two words or a number. Do not reuse the original question's ` +
  `wording or numbers.` +
  WORKED_EXAMPLE_GUIDE;

export function remediationSystemPrompt(kind: "scaffold" | "explain"): string {
  return kind === "scaffold" ? SCAFFOLD_SYSTEM : EXPLAIN_SYSTEM;
}

export function buildRemediationPrompt(input: RemediationInput, kind: "scaffold" | "explain"): string {
  return (
    `${describeQuestion(input)}\n\n` +
    (kind === "scaffold"
      ? `Build the scaffold. The last step's answer must equal the model answer's final value.`
      : `Write the teaching card and transfer check.`) +
    `\nReturn the JSON now.`
  );
}

// Whole-token mention of any value, including short numbers.
function mentionsAny(text: string, values: string[]): boolean {
  return values.some((v) => {
    const t = v.trim();
    if (!t) return false;
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}.])${esc}(?![\\p{L}\\p{N}]|\\.\\d)`, "iu").test(text);
  });
}

function validateStep(raw: unknown, i: number, secrets: string[], isLast: boolean): Validated<{ step: ScaffoldStep }> {
  const bad = (reason: string) => ({ ok: false as const, reason: `step ${i + 1}: ${reason}` });
  if (!raw || typeof raw !== "object") return bad("not an object");
  const r = raw as Record<string, unknown>;
  const prompt = typeof r.prompt === "string" ? r.prompt.trim() : "";
  if (prompt.length < 8 || prompt.length > 400) return bad("prompt must be 8-400 characters");
  const kind = r.kind;
  if (kind !== "numeric" && kind !== "text" && kind !== "fraction") return bad("kind must be numeric, text or fraction");
  let answer: string | number;
  if (kind === "numeric") {
    const text = typeof r.answer === "number" ? String(r.answer) : typeof r.answer === "string" ? r.answer : "";
    const p = parseNumericAnswer(text);
    if (!p || !Number.isFinite(p.value)) return bad("numeric answer must be a number");
    answer = typeof r.answer === "number" ? r.answer : p.value;
  } else if (kind === "fraction") {
    const text = typeof r.answer === "string" ? r.answer.replace(/\s/g, "") : "";
    const m = text.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (!m || Number(m[2]) === 0) return bad('fraction answer must look like "top/bottom"');
    answer = text;
  } else {
    const text = typeof r.answer === "string" ? r.answer.trim() : "";
    if (!text || text.length > 60) return bad("text answer must be 1-60 characters");
    answer = text;
  }
  const step: ScaffoldStep = { prompt, kind, answer };
  if (typeof r.unit === "string" && r.unit.trim() && r.unit.length <= 20) step.unit = r.unit.trim();
  if (typeof r.tolerancePercent === "number" && r.tolerancePercent >= 0 && r.tolerancePercent <= 10) {
    step.tolerancePercent = r.tolerancePercent;
  }
  if (Array.isArray(r.accepted)) {
    const acc = r.accepted.filter((a): a is string => typeof a === "string" && a.trim().length > 0 && a.length <= 60);
    if (acc.length) step.accepted = acc.slice(0, 6).map((a) => a.trim());
  }
  if (typeof r.hint === "string" && r.hint.trim()) {
    const hint = r.hint.trim();
    if (hint.length > 250) return bad("hint too long");
    if (mentionsAny(hint, [String(answer), ...secrets])) return bad("hint gives away the answer");
    step.hint = hint;
  }
  if (!isLast) {
    // Earlier steps must not hand over the question's final answer.
    if (!hintIsSafe(prompt, [], secrets)) return bad("prompt reveals the final answer");
  }
  return { ok: true, step };
}

export function validateScaffold(raw: unknown, input: RemediationInput): Validated<{ remediation: Remediation }> {
  const steps = raw && typeof raw === "object" ? (raw as { steps?: unknown }).steps : undefined;
  if (!Array.isArray(steps) || steps.length < 3 || steps.length > 5) return { ok: false, reason: "need 3 to 5 steps in {\"steps\":[...]}" };
  const target = finalAnswerTarget(input);
  if (!target) return { ok: false, reason: "no checkable final answer" };
  const secrets = hintSecrets(input);
  const out: ScaffoldStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const v = validateStep(steps[i], i, secrets, i === steps.length - 1);
    if (!v.ok) return v;
    out.push(v.step);
  }
  const last = out[out.length - 1];
  const asText = String(last.answer);
  let ok = false;
  if (target.kind === "text") ok = target.accepted.some((a) => answersMatch(asText, a));
  else {
    const p = parseNumericAnswer(asText);
    if (p) {
      if (target.kind === "numeric") {
        ok = markNumeric(asText, { value: target.value, tolerancePercent: target.tolerancePercent }).valueOk;
      } else {
        ok = target.values.some((v) => markNumeric(asText, { value: v, tolerancePercent: 1 }).valueOk);
      }
    }
  }
  if (!ok) return { ok: false, reason: "the last step's answer must equal the question's own answer" };
  return { ok: true, remediation: { type: "scaffold", steps: out } };
}

function validateTransfer(raw: unknown, input: RemediationInput): Validated<{ transferCheck: TransferCheck }> {
  const bad = (reason: string) => ({ ok: false as const, reason: `transferCheck: ${reason}` });
  if (!raw || typeof raw !== "object") return bad("missing");
  const r = raw as Record<string, unknown>;
  const prompt = typeof r.prompt === "string" ? r.prompt.trim() : "";
  if (prompt.length < 10 || prompt.length > 400) return bad("prompt must be 10-400 characters");
  if (hintSimilarity(prompt, input.prompt).dice >= 0.7) return bad("too similar to the original question");
  if (r.kind === "mcq") {
    const opts = Array.isArray(r.options) ? r.options : [];
    if (opts.length !== 4 || opts.some((o) => typeof o !== "string" || !o.trim() || o.length > 150)) {
      return bad("mcq needs exactly 4 non-empty options");
    }
    const options = (opts as string[]).map((o) => o.trim());
    if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return bad("options must be different");
    const ci = r.correctIndex;
    if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci > 3) return bad("correctIndex must be 0-3");
    return { ok: true, transferCheck: { prompt, kind: "mcq", options, correctIndex: ci } };
  }
  if (r.kind === "short") {
    const acc = Array.isArray(r.accepted)
      ? r.accepted.filter((a): a is string => typeof a === "string" && a.trim().length > 0 && a.length <= 60).map((a) => a.trim())
      : [];
    if (!acc.length) return bad("short needs at least one accepted answer (max 60 chars each)");
    return { ok: true, transferCheck: { prompt, kind: "short", accepted: acc.slice(0, 6) } };
  }
  return bad("kind must be mcq or short");
}

export function validateExplain(raw: unknown, input: RemediationInput): Validated<{ remediation: Remediation }> {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not a JSON object" };
  const r = raw as Record<string, unknown>;
  const content = typeof r.content === "string" ? r.content.trim() : "";
  const n = words(content);
  if (n < 60 || n > 120) return { ok: false, reason: `content must be 60-120 words (got ${n})` };
  const tc = validateTransfer(r.transferCheck, input);
  if (!tc.ok) return tc;
  // An invalid or missing scene is dropped, never fatal.
  const scene = r.scene ? parseScene(r.scene) : null;
  return { ok: true, remediation: { type: "explain", content, scene, transferCheck: tc.transferCheck } };
}

export function validateRemediation(
  raw: unknown,
  input: RemediationInput,
  kind: "scaffold" | "explain"
): Validated<{ remediation: Remediation }> {
  return kind === "scaffold" ? validateScaffold(raw, input) : validateExplain(raw, input);
}

/* ── checking learner answers (server actions) ────────────────────────── */

export function checkScaffoldAnswer(step: ScaffoldStep, given: string): boolean {
  const g = given.trim();
  if (!g) return false;
  if (step.kind === "numeric") {
    const target = typeof step.answer === "number" ? step.answer : parseNumericAnswer(step.answer)?.value;
    if (target === undefined || target === null) return false;
    const m = markNumeric(g, { value: target, tolerancePercent: step.tolerancePercent ?? 1 });
    return m.valueOk; // unit is not part of a scaffold step's marking
  }
  if (step.kind === "fraction") {
    const m = String(step.answer).match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    const gm = g.replace(/\s/g, "").match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (!m || !gm || Number(gm[2]) === 0) return false;
    // Same value (e.g. 6/4 and 3/2) counts.
    return Math.abs(Number(gm[1]) / Number(gm[2]) - Number(m[1]) / Number(m[2])) < 1e-9;
  }
  return [String(step.answer), ...(step.accepted ?? [])].some((a) => answersMatch(g, a));
}

export function checkTransferAnswer(tc: TransferCheck, given: string): boolean {
  const g = given.trim();
  if (!g) return false;
  if (tc.kind === "mcq") {
    const i = Number(g);
    if (Number.isInteger(i) && String(i) === g) return i === tc.correctIndex;
    return tc.correctIndex !== undefined && tc.options?.[tc.correctIndex]?.trim().toLowerCase() === g.toLowerCase();
  }
  return (tc.accepted ?? []).some((a) => answersMatch(g, a));
}
