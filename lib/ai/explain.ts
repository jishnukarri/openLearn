import "server-only";
import { chatJson, type ProviderConfig } from "./client";

const SCHEMA = {
  type: "object",
  properties: { explanation: { type: "string" } },
  required: ["explanation"],
};

// A short, on-demand explanation of why the correct answer is correct —
// shown after a student gets something wrong and taps "Explain this".
// Deliberately terse: 2-4 sentences, talking directly to the student.
export async function explainAnswer(
  question: string,
  correctAnswer: string,
  config?: ProviderConfig
): Promise<string> {
  const { explanation } = await chatJson<{ explanation: string }>(
    `A GCSE student just got this question wrong and wants to understand ` +
      `why the correct answer is correct.\n\nQuestion: ${question}\n\n` +
      `Correct answer: ${correctAnswer}\n\n` +
      `Explain why in 2-4 short sentences, talking directly to the student ` +
      `("you") in plain English. Teach the reasoning, not just a restatement ` +
      `of the answer. No markdown, no headings.`,
    SCHEMA,
    config
  );
  return explanation.trim();
}
