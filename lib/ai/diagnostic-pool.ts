import "server-only";
import { chatJson, type ProviderConfig } from "./client";
import type { QuestionType } from "./diagnostic";

// Generates a fixed bank of diagnostic questions for ONE topic, once, at
// topic-creation time — the admin-side cost that lets the guest-onboarding
// diagnostic sample questions for free instead of generating fresh
// questions per anonymous visitor (see lib/supabase/topic-diagnostic-questions.ts).
export const QUESTIONS_PER_TOPIC = 10;

export type PoolQuestion = {
  type: QuestionType;
  prompt: string;
  maxMarks: number;
  options: string[];
  correctIndex: number;
  blankAnswer: string;
  matchPairs: { left: string; right: string }[];
  markscheme: { point: string }[];
};

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mcq", "fill_blank", "match", "short_answer"] },
          prompt: { type: "string" },
          maxMarks: { type: "integer" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          blankAnswer: { type: "string" },
          matchPairs: {
            type: "array",
            items: {
              type: "object",
              properties: { left: { type: "string" }, right: { type: "string" } },
              required: ["left", "right"],
            },
          },
          markscheme: {
            type: "array",
            items: {
              type: "object",
              properties: { point: { type: "string" } },
              required: ["point"],
            },
          },
        },
        required: [
          "type", "prompt", "maxMarks", "options", "correctIndex",
          "blankAnswer", "matchPairs", "markscheme",
        ],
      },
    },
  },
  required: ["questions"],
};

export async function generateTopicDiagnosticPool(
  topicName: string,
  subjectName: string,
  config?: ProviderConfig
): Promise<PoolQuestion[]> {
  const result = await chatJson<{ questions: PoolQuestion[] }>(
    `Write exactly ${QUESTIONS_PER_TOPIC} GCSE diagnostic questions testing ` +
      `foundational knowledge of "${topicName}" (${subjectName}). Vary the ` +
      `question types — mix "mcq" (4 options, 1 mark), "fill_blank" (prompt ` +
      `contains a literal "___" blank, 1 mark), "match" (3-4 left/right ` +
      `pairs, 1 mark per pair), and "short_answer" (extended written ` +
      `answer, 2-4 marks, with a markscheme of that many distinct checkable ` +
      `points). Only fill in the fields relevant to each question's type; ` +
      `leave the rest as empty arrays/strings/zero. Cover the breadth of ` +
      `the topic, not just one narrow slice of it.`,
    SCHEMA,
    config
  );

  return result.questions.slice(0, QUESTIONS_PER_TOPIC);
}
