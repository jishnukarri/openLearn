import "server-only";
import { chatJson, forGeneration, type ProviderConfig } from "./client";

export type MarkPoint = { point: string };

// Discriminated union covering the real spread of GCSE question styles.
// Auto-marked formats (multiple-choice, short-answer, matching, and the
// final answer of calculation) never call the AI at marking time; the rest
// are marked against the markscheme by lib/ai/marking.ts.
export type QuestionFormat =
  | { type: "multiple-choice"; options: string[]; correctIndexes: number[] }
  | { type: "short-answer"; accepted: string[] }
  | {
      type: "calculation";
      answer: string;
      unit?: string;
      answerFormat?: "number" | "fraction" | "expression";
    }
  | {
      // Single-number answer (moles, forces, areas...). "answer" holds the
      // canonical value as text ("0.25"); no migration needed, it lives in
      // the existing format JSON.
      type: "numeric";
      answer: string;
      unit?: string;
      tolerancePercent?: number;
      sigFigs?: number;
    }
  | { type: "matching"; pairs: { left: string; right: string }[] }
  | {
      type: "structured";
      parts: { label: string; prompt: string; marks: number; markscheme: MarkPoint[] }[];
    }
  | { type: "data-analysis"; table: { headers: string[]; rows: string[][] } }
  | { type: "practical" }
  | { type: "extended" };

export type GeneratedQuestion = {
  prompt: string;
  markscheme: MarkPoint[];
  maxMarks: number;
  modelAnswer: string;
  format?: QuestionFormat | null;
  image?: { prompt: string; alt: string; url?: string } | null;
  // Set when the question is stored as part of a question bank.
  sectionIndex?: number | null;
  bankPosition?: number | null;
  imageUrl?: string | null;
};

const MARKSCHEME_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { point: { type: "string" } },
    required: ["point"],
  },
};

const SCHEMA = {
  type: "object",
  properties: {
    prompt: { type: "string" },
    maxMarks: { type: "integer" },
    markscheme: MARKSCHEME_SCHEMA,
    modelAnswer: { type: "string" },
    image: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        alt:    { type: "string" },
      },
      required: ["prompt", "alt"],
    },
    format: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "multiple-choice",
            "short-answer",
            "calculation",
            "numeric",
            "matching",
            "structured",
            "data-analysis",
            "practical",
            "extended",
          ],
        },
        options: { type: "array", items: { type: "string" } },
        correctIndexes: { type: "array", items: { type: "integer" } },
        accepted: { type: "array", items: { type: "string" } },
        answer: { type: "string" },
        unit: { type: "string" },
        tolerancePercent: { type: "number" },
        sigFigs: { type: "integer" },
        answerFormat: { type: "string", enum: ["number", "fraction", "expression"] },
        pairs: {
          type: "array",
          items: {
            type: "object",
            properties: { left: { type: "string" }, right: { type: "string" } },
            required: ["left", "right"],
          },
        },
        parts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              prompt: { type: "string" },
              marks: { type: "integer" },
              markscheme: MARKSCHEME_SCHEMA,
            },
            required: ["label", "prompt", "marks", "markscheme"],
          },
        },
        table: {
          type: "object",
          properties: {
            headers: { type: "array", items: { type: "string" } },
            rows: {
              type: "array",
              items: { type: "array", items: { type: "string" } },
            },
          },
          required: ["headers", "rows"],
        },
      },
      // Every type-specific field is required (even when unused for the
      // chosen "type") so a provider under strict JSON-schema mode can't
      // silently drop e.g. correctIndexes for "multiple-choice" — that
      // would otherwise make marking always fail. Unused fields should be
      // empty arrays/placeholder values, per the prompt guidance below.
      required: ["type", "options", "correctIndexes", "accepted", "answer", "pairs", "parts", "table"],
    },
  },
  required: ["prompt", "maxMarks", "markscheme", "modelAnswer", "format"],
};

const FORMAT_GUIDE =
  `Pick the question format that best fits the topic, using "format.type":\n` +
  `- "multiple-choice": options (4-6) + correctIndexes (1 or more correct).\n` +
  `- "short-answer": a single word/number/phrase answer. Put the canonical ` +
  `answer plus every acceptable spelling/synonym in "accepted".\n` +
  `- "calculation": maths/physics/chemistry working-out. Put the final ` +
  `numeric answer in "answer" and the unit (if any) in "unit". If the ` +
  `answer is a fraction, set "answerFormat" to "fraction" and write the ` +
  `simplified fraction with slash syntax like 3/10. If the answer is an ` +
  `exact symbolic result or expression, set "answerFormat" to "expression". ` +
  `The markscheme points cover the working steps.\n` +
  `- "numeric": ANY question whose answer is a number the student must work ` +
  `out (moles, concentration, speed, area, percentages, equations solved for ` +
  `a value). These must NEVER be "multiple-choice". Put the correct value as ` +
  `plain digits in "answer" (e.g. "0.25", no unit text), the unit in "unit" ` +
  `(e.g. "mol"), the acceptable relative tolerance in "tolerancePercent" ` +
  `(usually 1) and, where the question asks for it, the significant figures ` +
  `in "sigFigs". Markscheme points cover the working steps.\n` +
  `- "matching": 3-5 pairs of term ("left") and its matching description ` +
  `("right").\n` +
  `- "structured": multi-part question — parts labelled "a", "b", "c", each ` +
  `with its own prompt, marks, and markscheme points.\n` +
  `- "data-analysis": provide a small data table (headers + rows) and ask ` +
  `the student to interpret a trend, plot, or calculate from it.\n` +
  `- "practical": plan/evaluate an experiment — variables, validity, risk. ` +
  `The markscheme points cover those.\n` +
  `- "extended": a 4-6 mark continuous-prose explanation or essay answer.\n` +
  `"multiple-choice" is only for recall and concept questions. Vary formats across topics: use numeric or data-analysis for ` +
  `numerical topics, practical or structured for the sciences, extended ` +
  `for essay subjects. maxMarks must equal the total markscheme points ` +
  `(for "structured", the sum of part marks; each part's markscheme has ` +
  `exactly that part's marks worth of points). Write all text as plain ` +
  `prose — no markdown symbols. Write any mathematical notation as LaTeX ` +
  `wrapped in $ (inline) or $$ (standalone equation), never as plain-text ` +
  `approximations like x^2.\n` +
  `Every field in "format" is required by the schema even when your chosen ` +
  `"type" doesn't use it — for any field that doesn't apply, use an empty ` +
  `array [] (options, correctIndexes, accepted, pairs, parts), an empty ` +
  `string "" (answer), or {"headers": [], "rows": []} (table). Never omit ` +
  `a field.`;

export async function generateQuestion(
  topicName: string,
  subjectName: string,
  customInstructions?: string,
  config?: ProviderConfig
): Promise<GeneratedQuestion> {
  const instructionNote = customInstructions
    ? `\n\nThe admin who set up this topic left these instructions — follow ` +
      `them: ${customInstructions}`
    : "";

  return chatJson<GeneratedQuestion>(
    `Write one GCSE exam-style question on "${topicName}" (subject: ` +
      `"${subjectName}"), in the style and difficulty of a real UK GCSE ` +
      `paper.\n\n${FORMAT_GUIDE}\n\nThen write the markscheme as distinct, ` +
      `checkable points a marker would look for — each point gradeable ` +
      `independently, one mark each. Finally write a model answer: a ` +
      `concise, full-marks response hitting every markscheme point the way ` +
      `a strong student would write it.${instructionNote}`,
    SCHEMA,
    forGeneration(config)
  );
}

