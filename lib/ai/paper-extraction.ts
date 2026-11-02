import "server-only";
import { completeJson } from "./client";

export type ExtractedPaperQuestion = {
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionNumber: { type: "integer" },
          prompt: { type: "string" },
          maxMarks: { type: "integer" },
          markscheme: {
            type: "array",
            items: {
              type: "object",
              properties: { point: { type: "string" } },
              required: ["point"],
            },
          },
        },
        required: ["questionNumber", "prompt", "maxMarks", "markscheme"],
      },
    },
  },
  required: ["questions"],
};

const EXTRACTION_PROMPT =
  `You are given a question paper (one set of images) and its markscheme ` +
  `(a second set of images). Match questions across both documents by ` +
  `question number.\n\n` +
  `For each question, produce:\n` +
  `- questionNumber: the question number as printed (integer)\n` +
  `- prompt: the full question text, transcribed exactly, including any ` +
  `sub-parts (a), (b), etc. as part of the same prompt if the markscheme ` +
  `marks them as one question\n` +
  `- maxMarks: the total marks available for the question, from the ` +
  `markscheme (often shown in brackets like "[3 marks]" on the paper, or ` +
  `as a total in the markscheme)\n` +
  `- markscheme: an array of individual marking points a student's answer ` +
  `should be checked against, each as an object with a "point" field — ` +
  `one point per distinct fact/step that earns a mark, phrased so a marker ` +
  `(human or AI) can check "does the answer include this?"\n\n` +
  `Return every question found on the paper, in order. If a question has ` +
  `no clear markscheme match, still include it with your best-effort ` +
  `markscheme derived from question context.`;

export async function extractPaperQuestions(input: {
  questionPaperImages: { bytes: Buffer; contentType: string }[];
  markschemeImages: { bytes: Buffer; contentType: string }[];
}): Promise<ExtractedPaperQuestion[]> {
  const toImageUrl = (img: { bytes: Buffer; contentType: string }) => ({
    type: "image_url" as const,
    image_url: { url: `data:${img.contentType};base64,${img.bytes.toString("base64")}` },
  });

  const parsed = await completeJson<{ questions: ExtractedPaperQuestion[] }>({
    model: process.env.HACKCLUB_VISION_MODEL || "google/gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "text", text: "Question paper:" },
          ...input.questionPaperImages.map(toImageUrl),
          { type: "text", text: "Markscheme:" },
          ...input.markschemeImages.map(toImageUrl),
        ],
      },
    ],
    schema: EXTRACTION_SCHEMA,
  });
  return parsed.questions;
}
