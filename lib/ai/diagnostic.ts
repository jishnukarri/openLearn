import "server-only";
import { chatJson, type ProviderConfig } from "./client";
import { NUMERIC_PROMPT_NOTE, NUMERIC_SCHEMA_PROPS } from "@/lib/diagnostic-numeric";

export type DiagnosticSubjectInput = {
  subjectId: string;
  subjectName: string;
  topicNames?: string[];
};

export type QuestionType = "mcq" | "fill_blank" | "match" | "short_answer";

export type GeneratedDiagnosticQuestion = {
  subjectName: string;
  topicName: string;
  // "numeric" only exists at generation time; it is stored as fill_blank
  // with a `numeric` content block (see lib/diagnostic-numeric.ts).
  type: QuestionType | "numeric";
  prompt: string;
  maxMarks: number;
  options: string[];
  correctIndex: number;
  blankAnswer: string;
  numericUnit?: string;
  tolerancePercent?: number;
  sigFigs?: number;
  matchPairs: { left: string; right: string }[];
  markscheme: { point: string }[];
};

const MAX_QUESTIONS = 30;

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subjectName: { type: "string" },
          topicName: { type: "string" },
          type: {
            type: "string",
            enum: ["mcq", "fill_blank", "numeric", "match", "short_answer"],
          },
          prompt: { type: "string" },
          maxMarks: { type: "integer" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          blankAnswer: { type: "string" },
          ...NUMERIC_SCHEMA_PROPS,
          matchPairs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                left: { type: "string" },
                right: { type: "string" },
              },
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
          "subjectName",
          "topicName",
          "type",
          "prompt",
          "maxMarks",
          "options",
          "correctIndex",
          "blankAnswer",
          "matchPairs",
          "markscheme",
        ],
      },
    },
  },
  required: ["questions"],
};

export async function generateDiagnosticQuiz(
  subjects: DiagnosticSubjectInput[],
  mode: "fresh" | "recap",
  config?: ProviderConfig
): Promise<GeneratedDiagnosticQuestion[]> {
  const perSubject = Math.max(3, Math.floor(MAX_QUESTIONS / subjects.length));
  const subjectBrief = subjects
    .map((s) =>
      s.topicNames && s.topicNames.length > 0
        ? `${s.subjectName} (topics: ${s.topicNames.join(", ")})`
        : s.subjectName
    )
    .join("; ");

  const instruction =
    mode === "fresh"
      ? `Write a mixed diagnostic quiz covering foundational GCSE knowledge a ` +
        `student is expected to already know before starting these subjects: ` +
        `${subjectBrief}. Group questions under sensible topicName values ` +
        `for each subject. About ${perSubject} questions per subject.`
      : `Write a recap diagnostic quiz testing whether a student still ` +
        `remembers specific GCSE topics they say they've already covered: ` +
        `${subjectBrief}. Use the given topic names exactly as topicName. ` +
        `About ${perSubject} questions per topic.`;

  const result = await chatJson<{ questions: GeneratedDiagnosticQuestion[] }>(
    `${instruction}\n\nVary the question types across the quiz — mix ` +
      `"mcq" (4 options, 1 mark), "fill_blank" (prompt contains a literal ` +
      `"___" blank, 1 mark), "numeric" (calculation with a single numeric ` +
      `answer), "match" (3-4 left/right pairs to match, 1 mark ` +
      `per pair so maxMarks = number of pairs), and "short_answer" ` +
      `(extended written answer, 2-6 marks, with a markscheme of that many ` +
      `distinct checkable points). Only fill in the fields relevant to each ` +
      `question's type; leave the rest as empty arrays/strings/zero. ` +
      NUMERIC_PROMPT_NOTE,
    SCHEMA,
    config
  );

  return result.questions.slice(0, MAX_QUESTIONS);
}
