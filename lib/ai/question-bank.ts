import "server-only";
import { chatJson, type ProviderConfig } from "./client";
import type { MarkPoint, QuestionFormat } from "./questions";
import { distributeQuestions } from "@/lib/question-distribute";

export { distributeQuestions } from "@/lib/question-distribute";

export type BankedQuestion = {
  sectionIndex: number;
  bankPosition: number;
  prompt: string;
  markscheme: MarkPoint[];
  maxMarks: number;
  modelAnswer: string;
  format?: QuestionFormat | null;
  image?: { prompt: string; alt: string } | null;
};

const BANK_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionIndex: { type: "integer" },
          prompt:       { type: "string" },
          maxMarks:     { type: "integer" },
          markscheme: {
            type: "array",
            items: {
              type: "object",
              properties: { point: { type: "string" } },
              required: ["point"],
            },
          },
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
                  "multiple-choice", "short-answer", "calculation",
                  "matching", "structured", "data-analysis", "practical", "extended",
                ],
              },
              options:        { type: "array", items: { type: "string" } },
              correctIndexes: { type: "array", items: { type: "integer" } },
              accepted:       { type: "array", items: { type: "string" } },
              answer:         { type: "string" },
              unit:           { type: "string" },
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
                    label:      { type: "string" },
                    prompt:     { type: "string" },
                    marks:      { type: "integer" },
                    markscheme: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { point: { type: "string" } },
                        required: ["point"],
                      },
                    },
                  },
                  required: ["label", "prompt", "marks", "markscheme"],
                },
              },
              table: {
                type: "object",
                properties: {
                  headers: { type: "array", items: { type: "string" } },
                  rows:    { type: "array", items: { type: "array", items: { type: "string" } } },
                },
                required: ["headers", "rows"],
              },
            },
            required: ["type", "options", "correctIndexes", "accepted", "answer", "pairs", "parts", "table"],
          },
        },
        required: ["sectionIndex", "prompt", "maxMarks", "markscheme", "modelAnswer", "format"],
      },
    },
  },
  required: ["questions"],
};

export async function generateQuestionBank(
  topicName: string,
  subjectName: string,
  sections: { heading: string; explanation: string }[],
  customInstructions?: string,
  config?: ProviderConfig
): Promise<BankedQuestion[]> {
  const distribution = distributeQuestions(sections.length, 10);

  const sectionList = sections
    .map((s, i) => `Section ${i} — "${s.heading}": ${s.explanation}`)
    .join("\n");

  const distributionGuide = distribution
    .map((n, i) => `Section ${i} ("${sections[i].heading}"): ${n} question${n !== 1 ? "s" : ""}`)
    .join(", ");

  const instructionNote = customInstructions
    ? `\n\nAdmin instructions — follow these: ${customInstructions}`
    : "";

  const formatGuide =
    `For each question pick the format (format.type) that best fits:\n` +
    `- "multiple-choice": options (4-6) + correctIndexes.\n` +
    `- "short-answer": canonical answer + synonyms in "accepted".\n` +
    `- "calculation": numeric final answer in "answer", unit in "unit", working steps in markscheme.\n` +
    `- "matching": 3-5 left/right pairs.\n` +
    `- "structured": parts a/b/c each with their own prompt, marks, markscheme.\n` +
    `- "data-analysis": small table (headers + rows of strings), ask student to interpret.\n` +
    `- "practical": variables, method, risk — markscheme covers those points.\n` +
    `- "extended": 4-6 mark continuous-prose answer.\n` +
    `maxMarks must equal total markscheme points. Vary formats across the bank — do not reuse the same type for every question. ` +
    `All format fields are required even when unused — empty [] for lists, "" for strings, {"headers":[],"rows":[]} for table.\n` +
    `Write plain prose, no markdown symbols. Math as $...$ (inline LaTeX) or $$...$$ (standalone).`;

  const imageGuide =
    `\n\nOptionally include an "image" on a question when a diagram, graph, photograph, or ` +
    `data chart would make it a more realistic GCSE exam question. Write a descriptive "prompt" ` +
    `for an image generator and a screen-reader "alt" text. Omit the image field entirely when ` +
    `no visual adds genuine value. Most questions should have no image.`;

  const result = await chatJson<{ questions: BankedQuestion[] }>(
    `Generate a bank of exactly 10 GCSE exam-style questions on "${topicName}" ` +
      `(subject: "${subjectName}") in the style and difficulty of a real UK GCSE paper.\n\n` +
      `The lesson has ${sections.length} sections:\n${sectionList}\n\n` +
      `Distribute the 10 questions across sections as follows: ${distributionGuide}. ` +
      `Each question MUST include "sectionIndex" (0-based integer) matching its section above. ` +
      `Questions should be ordered by sectionIndex (section 0 first, section N last).\n\n` +
      `${formatGuide}${imageGuide}${instructionNote}`,
    BANK_SCHEMA,
    config
  );

  // Sort by sectionIndex then assign sequential bankPosition
  const sorted = [...result.questions].sort((a, b) => a.sectionIndex - b.sectionIndex);
  return sorted.map((q, i) => ({ ...q, bankPosition: i }));
}
