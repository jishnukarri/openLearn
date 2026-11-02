import "server-only";
import type { PointFeedback } from "./marking";
import { completeJson } from "./client";

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

const VISION_MODEL = () => process.env.HACKCLUB_VISION_MODEL || "google/gemini-2.5-flash";

const imageParts = (images: { bytes: Buffer; contentType: string }[]) =>
  images.map((img) => ({
    type: "image_url",
    image_url: { url: `data:${img.contentType};base64,${img.bytes.toString("base64")}` },
  }));

export async function detectReferenceCode(
  images: { bytes: Buffer; contentType: string }[]
): Promise<string | null> {
  const result = await completeJson<{ code: string | null }>({
    model: VISION_MODEL(),
    messages: [{ role: "user", content: [{ type: "text", text: CODE_PROMPT }, ...imageParts(images)] }],
    schema: CODE_SCHEMA,
  });
  return result.code ? result.code.trim().toUpperCase() : null;
}

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
    `Do not penalise spelling, grammar or punctuation, except where a key scientific term is misspelled so that it becomes a different or ambiguous term. Read the handwriting carefully. Below is every question on the paper with its ` +
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
  const parsed = await completeJson<{ results: Array<{ questionNumber: number; feedback: PointFeedback[] }> }>({
    model: VISION_MODEL(),
    messages: [{ role: "user", content: [{ type: "text", text: markPrompt(input.questions) }, ...imageParts(input.images)] }],
    schema: MARK_SCHEMA,
  });

  return parsed.results.map((r) => ({
    questionNumber: r.questionNumber,
    marksAwarded: r.feedback.filter((f) => f.met).length,
    feedback: r.feedback,
  }));
}
