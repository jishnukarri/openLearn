import type { QuestionFormat } from "@/lib/ai/questions";

// What the practice page sends to the client: everything needed to render
// the answering UI, with the answers themselves stripped out (correct
// indexes, accepted answers, calculation results stay server-side).
export type ClientFormat =
  | { type: "multiple-choice"; options: string[]; multi: boolean }
  | { type: "short-answer" }
  | { type: "calculation"; unit?: string; answerFormat?: "number" | "fraction" | "expression" }
  | { type: "numeric"; unit?: string }
  | {
      type: "matching";
      lefts: string[];
      // Shuffled for display; `index` is the right's original pair index so
      // the server can score picks without the client knowing the mapping.
      rights: { label: string; index: number }[];
    }
  | { type: "structured"; parts: { label: string; prompt: string; marks: number }[] }
  | { type: "data-analysis"; table: { headers: string[]; rows: string[][] } }
  | { type: "practical" }
  | { type: "extended" };

export function toClientFormat(
  format: QuestionFormat | null | undefined
): ClientFormat {
  if (!format) return { type: "extended" };
  switch (format.type) {
    case "multiple-choice":
      return {
        type: "multiple-choice",
        options: format.options,
        multi: format.correctIndexes.length > 1,
      };
    case "short-answer":
      return { type: "short-answer" };
    case "calculation":
      return { type: "calculation", unit: format.unit, answerFormat: format.answerFormat };
    case "numeric":
      return { type: "numeric", unit: format.unit };
    case "matching": {
      const rights = format.pairs
        .map((pair, index) => ({ label: pair.right, index }))
        .sort(() => Math.random() - 0.5);
      return {
        type: "matching",
        lefts: format.pairs.map((p) => p.left),
        rights,
      };
    }
    case "structured":
      return {
        type: "structured",
        parts: format.parts.map(({ label, prompt, marks }) => ({
          label,
          prompt,
          marks,
        })),
      };
    case "data-analysis":
      return { type: "data-analysis", table: format.table };
    case "practical":
      return { type: "practical" };
    default:
      return { type: "extended" };
  }
}
