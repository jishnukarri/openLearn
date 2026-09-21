import "server-only";
import type { PointFeedback } from "./marking";
import { hackClubFetch } from "./client";

// --- Reference code detection (one cheap call per uploaded file, before
// any grouping happens) -----------------------------------------------

const CODE_SCHEMA = {
  type: "object",
  properties: {
    code: { type: ["string", "null"] },
  },
  required: ["code"],
};

const CODE_PROMPT =
  `This is a page from a student's exam script. Students write a short ` +
  `reference code (letters and digits, usually 6 characters) somewhere on ` +
  `the page — often the top of the first page, sometimes on every page. ` +
  `Read it if visible and legible. Return { "code": "THECODE" } using the ` +
  `exact characters you see (uppercase), or { "code": null } if no code is ` +
  `visible or you cannot read it with confidence.`;

export async function detectReferenceCode(
  images: { bytes: Buffer; contentType: string }[]
): Promise<string | null> {
  const preferHackClub = process.env.AI_PROVIDER === "hackclub";
  const result =
    preferHackClub && process.env.HACKCLUB_API_KEY
      ? await detectViaHackClub(images)
      : process.env.GEMINI_API_KEY
        ? await detectViaGemini(images)
        : process.env.HACKCLUB_API_KEY
          ? await detectViaHackClub(images)
          : null;

  if (result === null) {
    throw new Error("Reference code detection needs a vision-capable AI key (Gemini or Hack Club) configured.");
  }
  return result.code ? result.code.trim().toUpperCase() : null;
}

async function detectViaGemini(
  images: { bytes: Buffer; contentType: string }[]
): Promise<{ code: string | null }> {
  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: CODE_PROMPT },
          ...images.map((img) => ({ inlineData: { mimeType: img.contentType, data: img.bytes.toString("base64") } })),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { code: { type: Type.STRING, nullable: true } },
        required: ["code"],
      },
    },
  });
  return JSON.parse(response.text ?? '{"code":null}') as { code: string | null };
}

async function detectViaHackClub(
  images: { bytes: Buffer; contentType: string }[]
): Promise<{ code: string | null }> {
  const response = await hackClubFetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.HACKCLUB_API_KEY}` },
    body: JSON.stringify({
      model: process.env.HACKCLUB_VISION_MODEL || "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CODE_PROMPT },
            ...images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.contentType};base64,${img.bytes.toString("base64")}` },
            })),
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "response", strict: true, schema: CODE_SCHEMA } },
    }),
  });
  if (!response.ok) {
    throw new Error(`Hack Club reference code detection failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as { code: string | null };
}

// --- Marking a whole student submission against every paper question in
// one call (matches lib/ai/marking.ts's markAnswersBatch precedent of
// batching multiple questions into one AI round-trip) ------------------

export type SubmissionQuestionResult = {
  questionNumber: number;
  marksAwarded: number;
  feedback: PointFeedback[];
};

const MARK_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionNumber: { type: "integer" },
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
        required: ["questionNumber", "feedback"],
      },
    },
  },
  required: ["results"],
};

function markPrompt(questions: { questionNumber: number; prompt: string; markscheme: { point: string }[] }[]) {
  return (
    `You are marking a student's handwritten exam script, shown as photo(s)/scan(s). ` +
    `Read the handwriting carefully. Below is every question on the paper with its ` +
    `markscheme. Find the student's answer to each question in the images (it may not ` +
    `answer every question) and mark strictly against the markscheme points — do not ` +
    `award credit for anything not covered by a point. For each point, decide met/not ` +
    `met with a short comment talking directly to the student ("you"), never "the ` +
    `student". If a question's answer isn't found in the images at all, omit it from ` +
    `your results entirely (don't guess).\n\n` +
    questions
      .map(
        (q) =>
          `---\nQuestion ${q.questionNumber}: ${q.prompt}\n` +
          `Markscheme:\n${q.markscheme.map((m, i) => `${i + 1}. ${m.point}`).join("\n")}`
      )
      .join("\n\n")
  );
}

export async function markSubmissionAgainstPaper(input: {
  questions: { questionNumber: number; prompt: string; maxMarks: number; markscheme: { point: string }[] }[];
  images: { bytes: Buffer; contentType: string }[];
}): Promise<SubmissionQuestionResult[]> {
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
    throw new Error("Submission marking needs a vision-capable AI key (Gemini or Hack Club) configured.");
  }

  return parsed.results.map((r) => ({
    questionNumber: r.questionNumber,
    marksAwarded: r.feedback.filter((f) => f.met).length,
    feedback: r.feedback,
  }));
}

async function markViaGemini(input: {
  questions: { questionNumber: number; prompt: string; markscheme: { point: string }[] }[];
  images: { bytes: Buffer; contentType: string }[];
}): Promise<{ results: Array<{ questionNumber: number; feedback: PointFeedback[] }> }> {
  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: markPrompt(input.questions) },
          ...input.images.map((img) => ({ inlineData: { mimeType: img.contentType, data: img.bytes.toString("base64") } })),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionNumber: { type: Type.INTEGER },
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
              required: ["questionNumber", "feedback"],
            },
          },
        },
        required: ["results"],
      },
    },
  });
  return JSON.parse(response.text ?? '{"results":[]}') as {
    results: Array<{ questionNumber: number; feedback: PointFeedback[] }>;
  };
}

async function markViaHackClub(input: {
  questions: { questionNumber: number; prompt: string; markscheme: { point: string }[] }[];
  images: { bytes: Buffer; contentType: string }[];
}): Promise<{ results: Array<{ questionNumber: number; feedback: PointFeedback[] }> }> {
  const response = await hackClubFetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.HACKCLUB_API_KEY}` },
    body: JSON.stringify({
      model: process.env.HACKCLUB_VISION_MODEL || "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: markPrompt(input.questions) },
            ...input.images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.contentType};base64,${img.bytes.toString("base64")}` },
            })),
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "response", strict: true, schema: MARK_SCHEMA } },
    }),
  });
  if (!response.ok) {
    throw new Error(`Hack Club submission marking failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as {
    results: Array<{ questionNumber: number; feedback: PointFeedback[] }>;
  };
}
