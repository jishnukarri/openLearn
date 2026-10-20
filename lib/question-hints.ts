import type { QuestionFormat } from "@/lib/ai/questions";
import { isKeyTerm } from "./spelling";

/*
 * Deterministic, AI-free hints for exam questions (pure; no server-only
 * imports so it is testable and usable from the server action).
 *
 *  L1  how to approach: marks, command-word guidance, topic.
 *  L2  one masked "framing" line per mark point (key terms and numbers
 *      replaced by "…"); calculations also get the formula (if the scheme has
 *      one, without numbers) and the unit. MCQ: rule out one wrong option.
 *  L3  one key word per point revealed only as first letter + length.
 *
 * Every level is run through a safety check (hintIsSafe): no run of hint tokens
 * may cover more than 60% of any mark-scheme point, and no accepted answer /
 * numeric answer may appear. An unsafe level falls back to a generic one.
 */

export const MAX_HINT_LEVEL = 3;
const MAX_POINTS_LISTED = 8;
const BLANK = "…";

export type HintInput = {
  prompt: string;
  markscheme: { point: string }[];
  maxMarks: number;
  format?: QuestionFormat | null;
  topicTitle?: string | null;
  subtopicTitle?: string | null;
};

type HintPoint = { label?: string; text: string };

// Words that give a point its shape without giving away the answer.
const FRAME_WORDS = new Set(
  (
    "a an the of to in on at by for with from and or but as is are was were be been being it its this that these those " +
    "when while if then than so because therefore which who what how why more less greater higher lower fewer larger smaller " +
    "increases increase increased decreases decrease decreased causes cause caused leads lead results result due not no each " +
    "every both only also can will does do has have had into out up down over under between through during after before per " +
    "describes explains means mean about there their they them we you your one"
  ).split(" ")
);

const COMMAND_WORDS: Record<string, string> = {
  describe: "Describe means say what happens or what something looks like, step by step, without explaining why.",
  explain: "Explain means give a reason: each point should say what happens and why, using words like 'because'.",
  state: "State means give a short, direct answer. No explanation is needed.",
  give: "Give means a short, direct answer. No explanation is needed.",
  name: "Name means a short, direct answer: one precise word or phrase.",
  identify: "Identify means pick out the correct thing and name it.",
  define: "Define means give the exact meaning of the term in one precise sentence.",
  calculate: "Calculate means work it out: write the formula, substitute your values, then give the answer with its unit.",
  compare: "Compare means write about similarities and differences, mentioning both things in each point.",
  evaluate: "Evaluate means weigh up both sides, then reach a judgement that you support with evidence.",
  suggest: "Suggest means apply what you know to this new situation and give a sensible idea with a reason.",
  outline: "Outline means give the main steps or ideas briefly, in order.",
  justify: "Justify means give a conclusion and the evidence or reasoning that supports it.",
  predict: "Predict means say what you expect to happen, based on the pattern you know.",
  discuss: "Discuss means give different points of view or factors, then say which is stronger.",
  determine: "Determine means work out the value or result from the information given.",
  complete: "Complete means fill in the missing information using the question's context.",
  draw: "Draw means produce a clear, labelled diagram or graph.",
  plan: "Plan means set out the steps you would follow, in a sensible order.",
};

/* ── text helpers ─────────────────────────────────────────────────────── */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase word tokens (letters/digits/%/./'), blanks and punctuation dropped. */
export function hintTokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[’]/g, "'")
      .replace(/(\d)\.(?=\d)/g, "$1\u0001")
      .match(/[\p{L}\p{N}\u0001'%^]+/gu)
      ?.map((t) => t.replace(/\u0001/g, ".").replace(/^'+|'+$/g, ""))
      .filter(Boolean) ?? []
  );
}

function coreWord(chunk: string): string {
  return chunk.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");
}

function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

function secretList(input: HintInput): string[] {
  const out: string[] = [];
  const f = input.format;
  if (f?.type === "short-answer") out.push(...f.accepted);
  if (f?.type === "calculation" || f?.type === "numeric") out.push(f.answer);
  return out
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Replace any secret (accepted/numeric answer) found in text with a blank. */
export function maskSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(secret)}(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, BLANK);
  }
  return out;
}

/* ── masking ──────────────────────────────────────────────────────────── */

/**
 * Keep the framing words of a mark point, blank out everything else
 * (key terms, numbers, units). Consecutive blanks collapse into one.
 */
export function maskPoint(point: string, secrets: string[] = []): string {
  const withoutSecrets = maskSecrets(point, secrets);
  const parts: string[] = [];
  for (const chunk of withoutSecrets.split(/\s+/).filter(Boolean)) {
    if (chunk.includes(BLANK)) {
      if (parts[parts.length - 1] !== BLANK) parts.push(BLANK);
      continue;
    }
    const word = coreWord(chunk);
    const keep = word.length > 0 && !hasDigit(word) && FRAME_WORDS.has(word.toLowerCase());
    const next = keep ? word.toLowerCase() : BLANK;
    if (next === BLANK && parts[parts.length - 1] === BLANK) continue;
    parts.push(next);
  }
  return parts.join(" ");
}

function visibleWordCount(masked: string): number {
  return masked.split(/\s+/).filter((w) => w && w !== BLANK).length;
}

/* ── safety ───────────────────────────────────────────────────────────── */

function longestCommonRun(a: string[], b: string[]): number {
  let best = 0;
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diagonal = tmp;
    }
  }
  return best;
}

/** Token sequence of the hint, with blanks acting as sequence breakers. */
function runsOf(hint: string): string[][] {
  return hint
    .split(BLANK)
    .map((seg) => hintTokens(seg))
    .filter((t) => t.length > 0);
}

/** Largest share (0..1) of any point's tokens that appears in sequence in the hint. */
export function maxPointOverlap(hint: string, points: string[]): number {
  const runs = runsOf(hint);
  let worst = 0;
  for (const point of points) {
    const pt = hintTokens(point);
    if (pt.length === 0) continue;
    for (const run of runs) {
      worst = Math.max(worst, longestCommonRun(pt, run) / pt.length);
    }
  }
  return worst;
}

/**
 * True when the hint reveals no more than 60% of any point in sequence and
 * contains none of the secrets (numeric secrets under 3 chars are skipped:
 * they would collide with ordinary counts such as "3 marks").
 */
export function hintIsSafe(hint: string, points: string[], secrets: string[] = []): boolean {
  if (maxPointOverlap(hint, points) > 0.6) return false;
  const lowered = hint.toLowerCase();
  for (const secret of secrets) {
    const s = secret.trim().toLowerCase();
    if (!s) continue;
    if (/^[\d.\s-]+$/.test(s) && s.replace(/\D/g, "").length < 3) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(s)}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(lowered)) return false;
  }
  return true;
}

/* ── derivation ───────────────────────────────────────────────────────── */

function pointsOf(input: HintInput): HintPoint[] {
  const f = input.format;
  if (f?.type === "structured") {
    return f.parts.flatMap((part) =>
      part.markscheme.map((m) => ({ label: part.label, text: m.point }))
    );
  }
  return input.markscheme.map((m) => ({ text: m.point }));
}

export function findCommandWord(prompt: string): string | null {
  let best: { word: string; at: number } | null = null;
  const lower = prompt.toLowerCase();
  for (const word of Object.keys(COMMAND_WORDS)) {
    const m = new RegExp(`\\b${word}\\b`).exec(lower);
    if (m && (!best || m.index < best.at)) best = { word, at: m.index };
  }
  return best?.word ?? null;
}

function pluralMarks(n: number): string {
  return `${n} ${n === 1 ? "mark" : "marks"}`;
}

function level1(input: HintInput, secrets: string[]): string {
  const marks = Math.max(1, input.maxMarks);
  const f = input.format;
  const lines: string[] = [];

  if (f?.type === "multiple-choice") {
    lines.push(
      f.correctIndexes.length > 1
        ? `This is worth ${pluralMarks(marks)}. More than one option is correct, so check every option against the question.`
        : `This is worth ${pluralMarks(marks)}. Read every option before choosing, and cross out any you know are wrong.`
    );
  } else if (f?.type === "matching") {
    lines.push(
      `This is worth ${pluralMarks(marks)}. Start with the pair you are surest about, then use what is left.`
    );
  } else if (f?.type === "structured") {
    lines.push(
      `This is worth ${pluralMarks(marks)} across ${f.parts.length} ${f.parts.length === 1 ? "part" : "parts"}. Answer each part separately and match your points to its marks.`
    );
  } else if (marks === 1) {
    lines.push("This is worth 1 mark: one clear, precise point is enough.");
  } else {
    lines.push(`This is worth ${marks} marks: aim for ${marks} separate points.`);
  }

  const command = findCommandWord(input.prompt);
  if (command && f?.type !== "multiple-choice" && f?.type !== "matching") {
    lines.push(COMMAND_WORDS[command]);
  }

  const place = [input.topicTitle, input.subtopicTitle]
    .map((s) => (s ? maskSecrets(s.trim(), secrets) : ""))
    .filter((s) => s && !s.includes(BLANK));
  if (place.length === 2 && place[0] !== place[1]) {
    lines.push(`Your answer sits in ${place[0]}, in particular ${place[1]}.`);
  } else if (place.length > 0) {
    lines.push(`Your answer sits in ${place[0]}.`);
  }

  return lines.join(" ");
}

function extractFormula(points: HintPoint[], secrets: string[]): string | null {
  for (const p of points) {
    const m = /[A-Za-zΔ][\w]*(?:\s*\([^)]*\))?\s*=\s*[^,;\n]+/.exec(p.text);
    if (!m) continue;
    const formula = m[0].trim().replace(/[.\s]+$/, "");
    // No worked numbers: digits are only allowed as powers / subscripts.
    if (/(?<![A-Za-z^_])\d/.test(formula)) continue;
    if (maskSecrets(formula, secrets) !== formula) continue;
    return formula;
  }
  return null;
}

function genericPointLine(n: number, text: string): string {
  const words = hintTokens(text).length;
  return `Point ${n}: an idea of roughly ${words} ${words === 1 ? "word" : "words"}.`;
}

function level2(input: HintInput, secrets: string[]): string {
  const f = input.format;

  if (f?.type === "multiple-choice") {
    const wrong = eliminationOrder(f);
    if (wrong.length === 0) {
      return "Look for the option that answers exactly what is asked, not one that is only partly true.";
    }
    return `Option ${String.fromCharCode(65 + wrong[0])} is not correct. Rule it out first.`;
  }
  if (f?.type === "matching") {
    return "Look for the link in meaning between each pair: the right-hand item should describe, name or result from the left-hand one.";
  }

  const points = pointsOf(input).slice(0, MAX_POINTS_LISTED);
  const lines: string[] = [];

  if (f?.type === "calculation" || f?.type === "numeric") {
    const formula = extractFormula(pointsOf(input), secrets);
    if (formula) lines.push(`Use: ${formula}`);
    if (f.unit) lines.push(`Give your answer in ${f.unit}.`);
    if (f.type === "numeric" && f.sigFigs) lines.push(`Give it to ${f.sigFigs} significant figures.`);
  }

  if (f?.type === "short-answer") {
    lines.push("Your answer is a short term or phrase. Think about the key word the question is pointing at.");
  }

  points.forEach((p, i) => {
    const masked = maskPoint(p.text, secrets);
    const prefix = `Point ${i + 1}${p.label ? ` (${p.label})` : ""}`;
    if (visibleWordCount(masked) < 2) {
      lines.push(genericPointLine(i + 1, p.text).replace(/^Point \d+/, prefix));
    } else {
      lines.push(`${prefix}: ${masked}`);
    }
  });

  return lines.join("\n");
}

function revealWord(word: string): string {
  return `starts with "${word[0].toLowerCase()}" and has ${word.length} letters`;
}

function pickKeyWord(text: string, secrets: string[]): string | null {
  const candidates = text
    .split(/\s+/)
    .map(coreWord)
    .filter((w) => w.length >= 4 && !hasDigit(w) && !FRAME_WORDS.has(w.toLowerCase()));
  if (candidates.length === 0) return null;
  const subject = (w: string) => isKeyTerm(w, { markSchemeText: text });
  const sorted = [...candidates].sort((a, b) => {
    const ka = subject(a) ? 1 : 0;
    const kb = subject(b) ? 1 : 0;
    return kb - ka || b.length - a.length;
  });
  void secrets;
  return sorted[0];
}

function level3(input: HintInput, secrets: string[]): string {
  const f = input.format;

  if (f?.type === "multiple-choice") {
    const wrong = eliminationOrder(f);
    if (wrong.length >= 2) {
      return `Options ${String.fromCharCode(65 + wrong[0])} and ${String.fromCharCode(65 + wrong[1])} are both not correct. Choose from what is left.`;
    }
    return "Compare the options that are left word by word with the question and pick the one that fits every part.";
  }
  if (f?.type === "matching") {
    return "Match the easiest pairs first. Each right-hand item is used once, so every pair you fix makes the rest simpler.";
  }

  const lines: string[] = [];

  if (f?.type === "short-answer") {
    const first = f.accepted.find((a) => a.trim().length > 0);
    if (first) {
      const w = first.trim().split(/\s+/);
      lines.push(
        w.length === 1
          ? `The answer ${revealWord(w[0])}.`
          : `The answer is ${w.length} words and starts with "${w[0][0].toLowerCase()}".`
      );
    }
  } else if (f?.type === "calculation" || f?.type === "numeric") {
    lines.push(
      "Write the formula, substitute each value with its unit, then work out the answer. Check the unit and the size of your answer make sense."
    );
    if (f.type === "numeric" && f.tolerancePercent !== undefined) {
      lines.push(`Your answer needs to be within ${f.tolerancePercent}% of the right value.`);
    }
  }

  pointsOf(input)
    .slice(0, MAX_POINTS_LISTED)
    .forEach((p, i) => {
      const prefix = `Point ${i + 1}${p.label ? ` (${p.label})` : ""}`;
      const word = pickKeyWord(maskSecrets(p.text, secrets), secrets);
      lines.push(
        word
          ? `${prefix}: a key word ${revealWord(word)}.`
          : `${prefix}: no single key word, so think about the whole idea.`
      );
    });

  return lines.join("\n");
}

/** Indexes of wrong options in a deterministic order (never the correct ones). */
function eliminationOrder(f: Extract<QuestionFormat, { type: "multiple-choice" }>): number[] {
  const wrong = f.options.map((_, i) => i).filter((i) => !f.correctIndexes.includes(i));
  // Keep at least two options standing.
  const maxRemovable = Math.max(0, f.options.length - Math.max(2, f.correctIndexes.length + 1));
  return wrong.slice(0, Math.min(2, maxRemovable));
}

function genericLevel(level: 2 | 3, input: HintInput): string {
  const n = pointsOf(input).length || input.markscheme.length || Math.max(1, input.maxMarks);
  return level === 2
    ? `Plan ${n} ${n === 1 ? "point" : "points"} before you write. Each one should be a different idea, linked back to the question.`
    : `Check each point is specific: use the exact key terms from this topic rather than everyday words.`;
}

/**
 * The hint ladder: always MAX_HINT_LEVEL strings, index 0 = Hint 1.
 * Deterministic; no network, no AI.
 */
export function deriveHints(input: HintInput): string[] {
  const secrets = secretList(input);
  const pointTexts = pointsOf(input).map((p) => p.text);
  const f = input.format;
  // MCQ options are the answers themselves, not mark points, so only check
  // the structural levels for them.
  const checkAgainst = f?.type === "multiple-choice" || f?.type === "matching" ? [] : pointTexts;

  const guard = (level: 1 | 2 | 3, raw: string): string => {
    // The formula line is allowed to mirror the scheme: it is the one thing
    // a calculation hint is meant to give.
    const checked = raw.split("\n").filter((l) => !l.startsWith("Use: ")).join("\n");
    if (raw.trim() && hintIsSafe(checked, checkAgainst, secrets)) return raw;
    if (level === 1) return `This is worth ${pluralMarks(Math.max(1, input.maxMarks))}. Plan your points before you write.`;
    return genericLevel(level, input);
  };

  return [
    guard(1, level1(input, secrets)),
    guard(2, level2(input, secrets)),
    guard(3, level3(input, secrets)),
  ];
}

/* ── anti-copy ────────────────────────────────────────────────────────── */

function multisetCommon(a: string[], b: string[]): number {
  const counts = new Map<string, number>();
  for (const t of b) counts.set(t, (counts.get(t) ?? 0) + 1);
  let common = 0;
  for (const t of a) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      common++;
      counts.set(t, c - 1);
    }
  }
  return common;
}

export const HINT_COPY_THRESHOLD = 0.8;
const MIN_TOKENS_FOR_CONTAINMENT = 4;

/**
 * How close an answer is to one hint text. Blank slots in the hint count
 * towards its size, so an answer that fills them with real content is not
 * mistaken for a copy.
 *  - dice: 2*common / (answer tokens + hint tokens + blanks)
 *  - containment: share of the answer's tokens that come from the hint
 */
export function hintSimilarity(answer: string, hint: string): { dice: number; containment: number; answerTokens: number } {
  const a = hintTokens(answer);
  const h = hintTokens(hint);
  const blanks = (hint.match(/…/g) ?? []).length;
  if (a.length === 0 || h.length === 0) return { dice: 0, containment: 0, answerTokens: a.length };
  const common = multisetCommon(a, h);
  return {
    dice: (2 * common) / (a.length + h.length + blanks),
    containment: common / a.length,
    answerTokens: a.length,
  };
}

function hintFragments(hint: string): string[] {
  const rawLines = hint.split("\n").map((l) => l.trim()).filter(Boolean);
  const lines = rawLines
    .map((l) => l.replace(/^\s*(point|mark)\s*\d+\s*(\([^)]*\))?\s*[:\-—]\s*/i, "").trim())
    .filter(Boolean);
  const sentences = hint
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [hint, ...rawLines, ...lines, ...sentences];
}

/** True when the answer is essentially one of the hints repeated back. */
export function isHintCopy(answer: string, shownHints: string[]): boolean {
  if (!answer.trim() || shownHints.length === 0) return false;
  for (const hint of shownHints) {
    for (const fragment of hintFragments(hint)) {
      const { dice, containment, answerTokens } = hintSimilarity(answer, fragment);
      if (dice >= HINT_COPY_THRESHOLD) return true;
      if (answerTokens >= MIN_TOKENS_FOR_CONTAINMENT && containment >= HINT_COPY_THRESHOLD && dice >= 0.5) return true;
    }
  }
  return false;
}

/** Candidate strings from an answer payload to test against shown hints. */
export function answerCandidates(parts: {
  text?: string;
  parts?: string[];
  answerText?: string;
}): string[] {
  return [parts.answerText, parts.text, ...(parts.parts ?? [])].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
}

export const HINT_COPY_MESSAGE =
  "That's the hint — put it in your own words using what you know.";

/** Clamp a client-supplied "hints shown" count to a valid level. */
export function clampHintLevel(raw: unknown): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_HINT_LEVEL, Math.floor(n)));
}
