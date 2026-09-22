import "server-only";
import { encode } from "@toon-format/toon";
import { chatJson, hackClubFetch, type ProviderConfig } from "./client";
import type { MarkPoint } from "./questions";

export type PointFeedback = { point: string; met: boolean; comment: string };
export type MarkingResult = { marksAwarded: number; feedback: PointFeedback[] };

const SCHEMA = {
  type: "object",
  properties: {
    feedback: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          met: { type: "boolean" },
          comment: { type: "string" },
        },
        required: ["point", "met", "comment"],
      },
    },
  },
  required: ["feedback"],
};

export async function markAnswer(
  input: {
    question: string;
    markscheme: MarkPoint[];
    studentAnswer: string;
  },
  config?: ProviderConfig
): Promise<MarkingResult> {
  const parsed = await chatJson<{ feedback: PointFeedback[] }>(
    `You are marking a GCSE exam answer strictly to the markscheme below. ` +
      `Do not award credit for anything not covered by a markscheme point. ` +
      `For each point, decide if the answer meets it, and give a short ` +
      `comment explaining why. Write the comment talking directly to the ` +
      `person who wrote the answer — say "you" and quote their own words ` +
      `back at them where useful, never say "the student".\n\n` +
      `Question: ${input.question}\n\n` +
      `Markscheme points:\n${input.markscheme.map((m, i) => `${i + 1}. ${m.point}`).join("\n")}\n\n` +
      `Answer: ${input.studentAnswer}`,
    SCHEMA,
    config
  );

  const marksAwarded = parsed.feedback.filter((f) => f.met).length;
  return { marksAwarded, feedback: parsed.feedback };
}

const MARK_PROMPT = (question: string, markscheme: MarkPoint[]) =>
  `You are marking a GCSE exam answer strictly to the markscheme below. The ` +
  `answer is handwritten, shown to you as photo(s)/scan(s) — read the ` +
  `handwriting carefully first, then mark exactly as you would typed text. ` +
  `Do not award credit for anything not covered by a markscheme point. For ` +
  `each point, decide if the answer meets it, and give a short comment ` +
  `explaining why, talking directly to the person who wrote it — say "you" ` +
  `and quote their own words back where useful, never say "the student". ` +
  `If the handwriting is illegible for a point, say so in the comment and ` +
  `mark it not met.\n\n` +
  `Question: ${question}\n\n` +
  `Markscheme points:\n${markscheme.map((m, i) => `${i + 1}. ${m.point}`).join("\n")}`;

// Marks a handwritten answer straight from photo/PDF uploads — no OCR step,
// the vision-capable model reads and marks in one pass. Follows AI_PROVIDER:
// when set to "hackclub" Hack Club's proxy is tried first; otherwise Gemini
// is preferred and Hack Club is the fallback, matching lib/ai/images.ts.
// Marks multiple short-answer questions in a single AI call — used at the
// end of the diagnostic quiz to avoid one AI round-trip per question.
export async function markAnswersBatch(
  items: Array<{
    questionId: string;
    question: string;
    markscheme: MarkPoint[];
    maxMarks: number;
    studentAnswer: string;
  }>,
  config?: ProviderConfig
): Promise<Array<{ questionId: string; score: number; marksAwarded: number }>> {
  if (items.length === 0) return [];

  const BATCH_SCHEMA = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionId: { type: "string" },
            feedback: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  point: { type: "string" },
                  met: { type: "boolean" },
                  comment: { type: "string" },
                },
                required: ["point", "met", "comment"],
              },
            },
          },
          required: ["questionId", "feedback"],
        },
      },
    },
    required: ["results"],
  };

  // TOON instead of hand-built prompt text: items is a uniform array of
  // flat objects (markscheme points joined into one string, rather than a
  // nested array, so the whole table stays tabular) — TOON's best case,
  // 30-60% fewer tokens than the JSON/prose equivalent for this shape.
  const encoded = encode({
    items: items.map((item) => ({
      questionId: item.questionId,
      question: item.question,
      markscheme: item.markscheme.map((m, i) => `${i + 1}. ${m.point}`).join(" | "),
      studentAnswer: item.studentAnswer,
    })),
  });

  const prompt =
    `You are marking GCSE diagnostic answers strictly to each question's markscheme. ` +
    `For each question, evaluate every markscheme point (given as "1. ... | 2. ...") ` +
    `and say whether the student's answer meets it. Respond with the questionId exactly ` +
    `as given.\n\nData (TOON format):\n${encoded}`;

  const parsed = await chatJson<{ results: Array<{ questionId: string; feedback: PointFeedback[] }> }>(
    prompt,
    BATCH_SCHEMA,
    config
  );

  return parsed.results.map((r) => {
    const item = items.find((i) => i.questionId === r.questionId);
    const marksAwarded = r.feedback.filter((f) => f.met).length;
    const score = item && item.maxMarks > 0 ? marksAwarded / item.maxMarks : 0;
    return { questionId: r.questionId, score, marksAwarded };
  });
}

export async function markAnswerFromImages(input: {
  question: string;
  markscheme: MarkPoint[];
  images: { bytes: Buffer; contentType: string }[];
}): Promise<MarkingResult> {
  const preferHackClub = process.env.AI_PROVIDER === "hackclub";
  const parsed =
    preferHackClub && process.env.HACKCLUB_API_KEY
      ? await markViaHackClub(input)
      : process.env.GEMINI_API_KEY
        ? await markViaGemini(input)
        : process.env.HACKCLUB_API_KEY
          ? await markViaHackClub(input)
          : null;

  if (!parsed) {
    throw new Error(
      "Photo marking needs a vision-capable AI key (Gemini or Hack Club) configured on the platform."
    );
  }

  const marksAwarded = parsed.feedback.filter((f) => f.met).length;
  return { marksAwarded, feedback: parsed.feedback };
}

async function markViaGemini(input: {
  question: string;
  markscheme: MarkPoint[];
  images: { bytes: Buffer; contentType: string }[];
}): Promise<{ feedback: PointFeedback[] }> {
  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: MARK_PROMPT(input.question, input.markscheme) },
          ...input.images.map((img) => ({
            inlineData: {
              mimeType: img.contentType,
              data: img.bytes.toString("base64"),
            },
          })),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          feedback: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                point: { type: Type.STRING },
                met: { type: Type.BOOLEAN },
                comment: { type: Type.STRING },
              },
              required: ["point", "met", "comment"],
            },
          },
        },
        required: ["feedback"],
      },
    },
  });

  return JSON.parse(response.text ?? "{}") as { feedback: PointFeedback[] };
}

async function markViaHackClub(input: {
  question: string;
  markscheme: MarkPoint[];
  images: { bytes: Buffer; contentType: string }[];
}): Promise<{ feedback: PointFeedback[] }> {
  const response = await hackClubFetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HACKCLUB_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.HACKCLUB_VISION_MODEL || "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: MARK_PROMPT(input.question, input.markscheme) },
            ...input.images.map((img) => ({
              type: "image_url",
              image_url: {
                url: `data:${img.contentType};base64,${img.bytes.toString("base64")}`,
              },
            })),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", strict: true, schema: SCHEMA },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Hack Club vision marking failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as { feedback: PointFeedback[] };
}
