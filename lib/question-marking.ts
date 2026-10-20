import type { QuestionFormat } from "@/lib/ai/questions";
import type { MarkingResult } from "@/lib/ai/marking";

// What the practice form posts for each format (JSON in `answerPayload`).
export type AnswerPayload = {
  selected?: number[]; // multiple-choice
  text?: string; // short-answer / calculation final answer / prose formats
  working?: string; // calculation working
  workingSteps?: string[]; // calculation working shown as separate lines
  matches?: number[]; // matching: index into rights, per left item
  parts?: string[]; // structured: one answer per part
  imagePaths?: string[]; // photographed/scanned handwritten answer, marked via vision
};

// Levenshtein distance — used for fuzzy short-answer tolerance.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// Accepts a minor typo in words ≥5 chars: 1 edit up to 8 chars, 2 edits for 9+.
function fuzzyMatch(given: string, accepted: string): boolean {
  const g = given.trim().toLowerCase();
  const a = accepted.trim().toLowerCase();
  const maxLen = Math.max(g.length, a.length);
  if (maxLen < 5) return false;
  const threshold = maxLen >= 9 ? 2 : 1;
  return levenshtein(g, a) <= threshold;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

// Common abbreviations used in student short answers.
// Keys are lowercase, matched as whole words (word boundary on each side).
const ABBREVIATIONS: Record<string, string> = {
  "no\\.": "number",
  "nos\\.": "numbers",
  "approx\\.": "approximately",
  "temp\\.": "temperature",
  "vol\\.": "volume",
  "vols\\.": "volumes",
  "conc\\.": "concentration",
  "soln\\.": "solution",
  "eq\\.": "equation",
  "eqn\\.": "equation",
  "amt\\.": "amount",
  "diff\\.": "difference",
  "avg\\.": "average",
  "max\\.": "maximum",
  "min\\.": "minimum",
  "freq\\.": "frequency",
  "vel\\.": "velocity",
  "acc\\.": "acceleration",
  "dist\\.": "distance",
  "mag\\.": "magnitude",
  "prop\\.": "proportional",
  "def\\.": "definition",
  "e\\.g\\.": "for example",
  "i\\.e\\.": "that is",
};

function expandAbbreviations(s: string): string {
  let result = s.toLowerCase();
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(`(?<![a-z])${abbr}(?![a-z])`, "gi"), full);
  }
  return result.replace(/\s+/g, " ").trim();
}

function normalizeMathText(input: string): string {
  return norm(input)
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/\\sqrt/g, "sqrt");
}

function parseFraction(input: string): { numerator: number; denominator: number } | null {
  const trimmed = norm(input).replace(/\s+/g, "");
  const slashMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (slashMatch) {
    const numerator = Number(slashMatch[1]);
    const denominator = Number(slashMatch[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return { numerator, denominator };
    }
  }

  const latexMatch = trimmed.match(/^\\frac\{(-?\d+(?:\.\d+)?)\}\{(-?\d+(?:\.\d+)?)\}$/);
  if (latexMatch) {
    const numerator = Number(latexMatch[1]);
    const denominator = Number(latexMatch[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return { numerator, denominator };
    }
  }

  return null;
}

function rationalValue(input: string): number | null {
  const fraction = parseFraction(input);
  if (fraction) return fraction.numerator / fraction.denominator;

  const numeric = Number(norm(input).replace(/,/g, ""));
  return Number.isNaN(numeric) ? null : numeric;
}

// Numeric-aware comparison: "0.50" matches "0.5", "3/10" matches "0.3",
// otherwise normalized text.
export function answersMatch(given: string, accepted: string): boolean {
  const g = norm(given);
  const a = norm(accepted);
  if (g === a) return true;

  // Expand abbreviations on the raw strings (before norm strips trailing dots)
  // then norm the expanded result so casing/whitespace is still cleaned up.
  const ge = norm(expandAbbreviations(given));
  const ae = norm(expandAbbreviations(accepted));
  if (ge === ae) return true;
  if (ge === a || g === ae) return true;

  const gm = normalizeMathText(given);
  const am = normalizeMathText(accepted);
  if (gm === am) return true;

  const gf = parseFraction(g);
  const af = parseFraction(a);
  if (gf && af) {
    return gf.numerator * af.denominator === af.numerator * gf.denominator;
  }

  const gn = rationalValue(g);
  const an = rationalValue(a);
  if (gn !== null && an !== null && gn === an) return true;

  // Fuzzy: accept minor typos in longer words (spelling variations, UK/US).
  // Only fires after all exact and numeric checks have failed.
  if (fuzzyMatch(ge, ae)) return true;

  return false;
}


// ---------------------------------------------------------------------------
// Numeric answers (calculation questions answered with a single number).
// ---------------------------------------------------------------------------

export type NumericSpec = {
  value: number;
  unit?: string;
  // Relative tolerance as a percentage (default 1).
  tolerancePercent?: number;
  // Significant figures the answer should be given to; widens the tolerance
  // to half a unit in the last place so a correctly rounded answer passes.
  sigFigs?: number;
};

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
};

function cleanNumberText(input: string): string {
  return input
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => `^${SUPERSCRIPTS[c]}`)
    .replace(/\\times|×|✕|\bx(?=\s*10)/gi, "x")
    .replace(/[−–]/g, "-")
    .trim();
}

// Splits "3.2 mol", "3,200 g", "3.2e3 J", "3.2 x 10^3 J", "3/4 m" into a
// numeric value and the trailing unit text. Returns null when no leading
// number can be read.
export function parseNumericAnswer(input: string): { value: number; unit: string } | null {
  const text = cleanNumberText(input);
  if (!text) return null;

  const frac = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (frac) {
    const d = Number(frac[2]);
    if (d === 0) return null;
    return { value: Number(frac[1]) / d, unit: frac[3].trim() };
  }

  const sci = text.match(
    /^([+-]?(?:\d[\d,]*)?\.?\d+)\s*x\s*10\s*\^?\s*\{?\s*([+-]?\d+)\}?\s*(.*)$/i
  );
  if (sci) {
    const mant = Number(sci[1].replace(/,/g, ""));
    const v = mant * Math.pow(10, Number(sci[2]));
    if (Number.isFinite(v)) return { value: v, unit: sci[3].trim() };
  }

  const plain = text.match(/^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:e[+-]?\d+)?)(?![\d.])\s*(.*)$/i);
  if (plain && /\d/.test(plain[1])) {
    const v = Number(plain[1].replace(/,/g, ""));
    if (Number.isFinite(v)) return { value: v, unit: plain[2].trim() };
  }
  return null;
}

function normUnit(u: string): string {
  return u
    .toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => `^${SUPERSCRIPTS[c]}`)
    .replace(/[·.*\s]/g, "")
    .replace(/\^/g, "")
    .replace(/[()]/g, "")
    .replace(/per/g, "/")
    .replace(/μ|µ/g, "u")
    .replace(/s$/, (m, off, str) => (str.length > 3 ? "" : m));
}

export type NumericMark = {
  fraction: 0 | 0.5 | 1;
  valueOk: boolean;
  unitOk: boolean | null; // null when the question has no unit
  parsed: boolean;
};

export function markNumeric(given: string, spec: NumericSpec): NumericMark {
  const parsed = parseNumericAnswer(given);
  if (!parsed) return { fraction: 0, valueOk: false, unitOk: null, parsed: false };

  const rel = (spec.tolerancePercent ?? 1) / 100;
  let tol = Math.abs(spec.value) * rel;
  if (spec.sigFigs && spec.value !== 0) {
    const half = 0.5 * Math.pow(10, Math.floor(Math.log10(Math.abs(spec.value))) - spec.sigFigs + 1);
    tol = Math.max(tol, half);
  }
  tol = Math.max(tol, 1e-9);
  const valueOk = Math.abs(parsed.value - spec.value) <= tol * (1 + 1e-9);

  let unitOk: boolean | null = null;
  if (spec.unit) {
    unitOk = parsed.unit !== "" && normUnit(parsed.unit) === normUnit(spec.unit);
  }
  const fraction = !valueOk ? 0 : unitOk === false ? 0.5 : 1;
  return { fraction, valueOk, unitOk, parsed: true };
}

function specFromFormat(format: Extract<QuestionFormat, { type: "numeric" }>): NumericSpec | null {
  const parsed = parseNumericAnswer(format.answer);
  if (!parsed) return null;
  return {
    value: parsed.value,
    unit: format.unit,
    tolerancePercent: format.tolerancePercent,
    sigFigs: format.sigFigs,
  };
}

function numericResult(
  mark: NumericMark,
  spec: NumericSpec,
  answerText: string,
  maxMarks: number
): MarkingResult {
  const awarded =
    mark.fraction === 1 ? maxMarks : mark.fraction > 0 ? Math.max(1, Math.floor(maxMarks / 2)) : 0;
  const shown = `${answerText}${spec.unit && !answerText.includes(spec.unit) ? ` ${spec.unit}` : ""}`;
  const feedback = [
    {
      point: `Answer: ${shown}`,
      met: mark.valueOk,
      comment: mark.valueOk ? "The value is right." : "The value is outside the accepted range.",
    },
  ];
  if (spec.unit && mark.valueOk) {
    feedback.push({
      point: `Unit: ${spec.unit}`,
      met: mark.unitOk === true,
      comment: mark.unitOk ? "Unit given correctly." : "Right value, but the unit is missing or different.",
    });
  }
  return { marksAwarded: awarded, feedback };
}

// Auto-marks the objective formats, returning the same MarkingResult shape
// the AI marker produces so the feedback UI needs no special cases.
// Returns null for formats that need AI marking.
export function autoMark(
  format: QuestionFormat,
  payload: AnswerPayload,
  maxMarks: number
): MarkingResult | null {
  switch (format.type) {
    case "multiple-choice": {
      const selected = new Set(payload.selected ?? []);
      const correct = new Set(format.correctIndexes);
      const right =
        selected.size === correct.size &&
        [...selected].every((i) => correct.has(i));
      return {
        marksAwarded: right ? maxMarks : 0,
        feedback: [
          {
            point: `Correct answer: ${format.correctIndexes
              .map((i) => format.options[i])
              .join(", ")}`,
            met: right,
            comment: right
              ? "You picked exactly the right options."
              : "Your selection didn't match the correct options.",
          },
        ],
      };
    }
    case "short-answer": {
      const given = payload.text ?? "";
      const hit = format.accepted.some((a) => answersMatch(given, a));
      if (!hit && given.trim() !== "") return null; // near-miss → AI judges
      return {
        marksAwarded: hit ? maxMarks : 0,
        feedback: [
          {
            point: `Accepted answer: ${format.accepted[0] ?? ""}`,
            met: hit,
            comment: hit ? "Exactly right." : "No answer given.",
          },
        ],
      };
    }
    case "matching": {
      const matches = payload.matches ?? [];
      const results = format.pairs.map((pair, i) => {
        const met = matches[i] === i;
        return {
          point: `${pair.left} → ${pair.right}`,
          met,
          comment: met ? "Matched correctly." : "Not the right match.",
        };
      });
      const correct = results.filter((r) => r.met).length;
      return {
        marksAwarded: Math.round((correct / format.pairs.length) * maxMarks),
        feedback: results,
      };
    }
    case "numeric": {
      const spec = specFromFormat(format);
      if (!spec) return null;
      const given = payload.text ?? "";
      const mark = markNumeric(given, spec);
      if (mark.fraction === 0 && maxMarks > 1 && given.trim() !== "") return null; // AI marks working
      return numericResult(mark, spec, format.answer, maxMarks);
    }
    case "calculation": {
      const given = payload.text ?? "";
      const right = answersMatch(given, format.answer);
      if (!right) return null; // wrong final answer → AI marks the working
      return {
        marksAwarded: maxMarks,
        feedback: [
          {
            point: `Final answer: ${format.answer}${format.unit ? ` ${format.unit}` : ""}`,
            met: true,
            comment: "Your final answer is spot on — full marks.",
          },
        ],
      };
    }
    default:
      return null;
  }
}

// Renders whatever the student submitted as readable text for storage and
// for handing to the AI marker.
export function payloadToText(
  format: QuestionFormat | null | undefined,
  payload: AnswerPayload
): string {
  if (!format) return payload.text ?? "";
  switch (format.type) {
    case "multiple-choice":
      return (payload.selected ?? [])
        .map((i) => format.options[i])
        .filter(Boolean)
        .join(", ");
    case "matching":
      return format.pairs
        .map((pair, i) => {
          const picked = format.pairs[(payload.matches ?? [])[i]]?.right;
          return `${pair.left} → ${picked ?? "(no match)"}`;
        })
        .join("\n");
    case "structured":
      return format.parts
        .map((part, i) => `(${part.label}) ${(payload.parts ?? [])[i] ?? ""}`)
        .join("\n\n");
    case "numeric":
      return payload.text ? `Final answer: ${payload.text}` : "";
    case "calculation":
      return [
        payload.text ? `Final answer: ${payload.text}` : "",
        payload.workingSteps?.length
          ? `Working:\n${payload.workingSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`
          : payload.working
            ? `Working:\n${payload.working}`
            : "",
      ]
        .filter(Boolean)
        .join("\n");
    default:
      return payload.text ?? "";
  }
}
