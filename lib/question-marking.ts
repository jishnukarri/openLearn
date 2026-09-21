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
