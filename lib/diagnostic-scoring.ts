import type { DiagnosticQuestion } from "@/lib/supabase/diagnostic";
import { markNumeric, parseNumericAnswer } from "./question-marking";
import { matchesExpected } from "./spelling";
import { readNumericMeta } from "./diagnostic-numeric";

// One diagnostic question's answer, submitted from a single level page.
export type LevelAnswerPayload = {
  mcqIndex?: number;
  blankText?: string;
  matches?: number[]; // per left item: chosen right's original pair index, or -1
  shortAnswer?: string;
};

const MAX_ANSWER_TEXT = 2000;

/** Coerces the untrusted posted JSON into a well-typed, size-capped payload. */
export function sanitiseLevelPayload(raw: unknown): LevelAnswerPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: LevelAnswerPayload = {};
  if (Number.isInteger(o.mcqIndex)) out.mcqIndex = o.mcqIndex as number;
  if (typeof o.blankText === "string") out.blankText = o.blankText.slice(0, MAX_ANSWER_TEXT);
  if (typeof o.shortAnswer === "string") out.shortAnswer = o.shortAnswer.slice(0, MAX_ANSWER_TEXT);
  if (Array.isArray(o.matches)) {
    out.matches = o.matches.slice(0, 50).map((n) => (Number.isInteger(n) ? (n as number) : -1));
  }
  return out;
}

// Scores objective question types instantly (no AI). Returns null for
// short_answer — those are batch-marked by markAnswersBatch at the end.
export function scoreDiagnosticAnswerInstant(
  question: DiagnosticQuestion,
  payload: LevelAnswerPayload
): number | null {
  if (!payload || typeof payload !== "object") return 0;
  switch (question.type) {
    case "mcq": {
      const content = question.content as { correctIndex: number };
      return payload.mcqIndex === content.correctIndex ? 1 : 0;
    }
    case "fill_blank": {
      const content = question.content as { blankAnswer: string };
      const meta = readNumericMeta(question.content);
      if (meta) {
        const target = parseNumericAnswer(content.blankAnswer);
        if (!target) return 0;
        const given = typeof payload.blankText === "string" ? payload.blankText : "";
        return markNumeric(given, { value: target.value, ...meta }).fraction;
      }
      // Not AI-marked — a plain string comparison against whatever single
      // phrasing the AI happened to generate as "the" answer. Forgiving a
      // trailing full stop, a leading article, and stray whitespace closes
      // the most common false-negative gap (a genuinely correct answer
      // marked wrong for reasons that have nothing to do with the content)
      // without needing multiple accepted answers or an AI call here.
      const normalize = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/^(a|an|the)\s+/, "")
          .replace(/[.,!?;:'"]+$/, "")
          .replace(/\s+/g, " ");
      if (typeof payload.blankText !== "string") return 0;
      const gotN = normalize(payload.blankText);
      const wantN = normalize(content.blankAnswer);
      if (!gotN) return 0;
      if (gotN === wantN) return 1;
      // Fill-blank in diagnostics: expected answer is treated as a key term
      // (stricter: exact, or 1 edit on 8+ chars) unless it is an ordinary word.
      return matchesExpected(gotN, wantN).matched ? 1 : 0;
    }
    case "match": {
      const content = question.content as {
        pairs: { left: string; right: string }[];
      };
      const matches = payload.matches ?? [];
      const correct = content.pairs.filter((_, i) => matches[i] === i).length;
      return content.pairs.length > 0 ? correct / content.pairs.length : 0;
    }
    case "short_answer":
      return null; // handled by markAnswersBatch at session end
    default:
      return 0;
  }
}
