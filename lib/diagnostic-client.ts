import type { DiagnosticQuestion } from "@/lib/supabase/diagnostic";

// What a diagnostic level page sends to the client — the answer key
// (correctIndex, blankAnswer, which right matches which left) always stays
// server-side; scoring happens in the level's submit action.
export type ClientDiagnosticQuestion = {
  id: string;
  prompt: string;
  maxMarks: number;
  topicName: string | null;
} & (
  | { type: "mcq"; options: string[] }
  | { type: "fill_blank" }
  | { type: "match"; lefts: string[]; rights: { label: string; index: number }[] }
  | { type: "short_answer" }
);

export function toClientDiagnosticQuestion(
  q: DiagnosticQuestion
): ClientDiagnosticQuestion {
  const base = {
    id: q.id,
    prompt: q.prompt,
    maxMarks: q.max_marks,
    topicName: q.topic_name,
  };

  switch (q.type) {
    case "mcq": {
      const content = q.content as { options: string[] };
      return { ...base, type: "mcq", options: content.options };
    }
    case "match": {
      const content = q.content as { pairs: { left: string; right: string }[] };
      const rights = content.pairs
        .map((pair, index) => ({ label: pair.right, index }))
        .sort(() => Math.random() - 0.5);
      return {
        ...base,
        type: "match",
        lefts: content.pairs.map((p) => p.left),
        rights,
      };
    }
    case "fill_blank":
      return { ...base, type: "fill_blank" };
    default:
      return { ...base, type: "short_answer" };
  }
}
