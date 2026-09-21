import "server-only";
import { hackClubFetch } from "./client";

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
  const preferHackClub = process.env.AI_PROVIDER === "hackclub";
  const parsed =
    preferHackClub && process.env.HACKCLUB_API_KEY
      ? await extractViaHackClub(input)
      : process.env.GEMINI_API_KEY
        ? await extractViaGemini(input)
        : process.env.HACKCLUB_API_KEY
          ? await extractViaHackClub(input)
          : null;

  if (!parsed) {
    throw new Error(
      "Paper extraction needs a vision-capable AI key (Gemini or Hack Club) configured on the platform."
    );
  }

  return parsed.questions;
}

function imageParts(images: { bytes: Buffer; contentType: string }[]) {
  return images.map((img) => ({
    inlineData: { mimeType: img.contentType, data: img.bytes.toString("base64") },
  }));
}

async function extractViaGemini(input: {
  questionPaperImages: { bytes: Buffer; contentType: string }[];
  markschemeImages: { bytes: Buffer; contentType: string }[];
}): Promise<{ questions: ExtractedPaperQuestion[] }> {
  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACTION_PROMPT },
          { text: "Question paper:" },
          ...imageParts(input.questionPaperImages),
          { text: "Markscheme:" },
          ...imageParts(input.markschemeImages),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionNumber: { type: Type.INTEGER },
                prompt: { type: Type.STRING },
                maxMarks: { type: Type.INTEGER },
                markscheme: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { point: { type: Type.STRING } },
                    required: ["point"],
                  },
                },
              },
              required: ["questionNumber", "prompt", "maxMarks", "markscheme"],
            },
          },
        },
        required: ["questions"],
      },
    },
  });

  return JSON.parse(response.text ?? '{"questions":[]}') as { questions: ExtractedPaperQuestion[] };
}

async function extractViaHackClub(input: {
  questionPaperImages: { bytes: Buffer; contentType: string }[];
  markschemeImages: { bytes: Buffer; contentType: string }[];
}): Promise<{ questions: ExtractedPaperQuestion[] }> {
  const toImageUrl = (img: { bytes: Buffer; contentType: string }) => ({
    type: "image_url" as const,
    image_url: { url: `data:${img.contentType};base64,${img.bytes.toString("base64")}` },
  });

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
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "text", text: "Question paper:" },
            ...input.questionPaperImages.map(toImageUrl),
            { type: "text", text: "Markscheme:" },
            ...input.markschemeImages.map(toImageUrl),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", strict: true, schema: EXTRACTION_SCHEMA },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Hack Club paper extraction failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as { questions: ExtractedPaperQuestion[] };
}
