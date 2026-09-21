import "server-only";

import { chatJson, type ProviderConfig } from "./client";

const TUTOR_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
  },
  required: ["reply"],
};

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    explanation: { type: "string" },
    example: { type: "string" },
  },
  required: ["reply", "explanation", "example"],
};

export async function askLessonTutor(
  topicName: string,
  subjectName: string,
  lessonContext: string,
  question: string,
  config: ProviderConfig
): Promise<string> {
  const result = await chatJson<{ reply: string }>(
    `You are a warm, concise GCSE study coach helping a student while they ` +
      `work through a lesson on "${topicName}" in ${subjectName}. The active ` +
      `lesson step is:\n${lessonContext}\n\nThe student asks: "${question}"\n\n` +
      `Answer only their question. Be encouraging, use plain English, and keep ` +
      `the answer to 2-4 short sentences. Teach the idea rather than just ` +
      `giving an answer. If they ask for a hint, give one useful next step and ` +
      `do not reveal the final answer. Do not use markdown headings, lists, or ` +
      `formatting symbols.`,
    TUTOR_SCHEMA,
    config
  );

  return result.reply.trim();
}

export async function rewriteLessonStep(
  topicName: string,
  subjectName: string,
  lessonContext: string,
  config: ProviderConfig
): Promise<{ reply: string; explanation: string; example: string }> {
  const result = await chatJson<{ reply: string; explanation: string; example: string }>(
    `You are a GCSE study coach. Rewrite the active lesson step below for a ` +
      `student studying "${topicName}" in ${subjectName}. Keep the exact same ` +
      `meaning and do not introduce new facts. Make it clearer, more direct, ` +
      `and easier to follow.\n\n${lessonContext}\n\nReturn a brief friendly ` +
      `"reply" saying what you changed, a 2-3 sentence plain-prose ` +
      `"explanation", and one short, concrete "example". Do not use Markdown.`,
    REWRITE_SCHEMA,
    config
  );

  return {
    reply: result.reply.trim(),
    explanation: result.explanation.trim(),
    example: result.example.trim(),
  };
}

const ADAPT_SCHEMA = {
  type: "object",
  properties: {
    adapted: { type: "boolean" },
    explanation: { type: "string" },
    example: { type: "string" },
  },
  required: ["adapted", "explanation", "example"],
};

// Adaptive learning: called when a student just got the previous section's
// quick check wrong. Doesn't touch the lesson's length or structure —
// either leaves the next section exactly as-is (adapted: false, when the
// struggle genuinely doesn't bear on it), or adds a brief bridging
// sentence tying the new idea back to what tripped them up. Never rewrites
// wholesale and never pads for the sake of it.
export async function adaptNextSection(
  topicName: string,
  subjectName: string,
  struggledConcept: { heading: string; explanation: string },
  nextSection: { heading: string; explanation: string; example: string },
  config: ProviderConfig
): Promise<{ adapted: boolean; explanation: string; example: string }> {
  const result = await chatJson<{ adapted: boolean; explanation: string; example: string }>(
    `A GCSE student studying "${topicName}" in ${subjectName} just got the ` +
      `quick check wrong on this idea, meaning it likely didn't fully land:\n` +
      `"${struggledConcept.heading}" — ${struggledConcept.explanation}\n\n` +
      `They're about to move on to the next section:\n` +
      `"${nextSection.heading}" — ${nextSection.explanation}\n` +
      `Example: ${nextSection.example}\n\n` +
      `Decide: does the struggled idea genuinely bear on this next section — ` +
      `is it a prerequisite, or easy to confuse with it? If not, set "adapted" ` +
      `to false and return the explanation/example completely unchanged. If ` +
      `it does, set "adapted" to true and lightly revise the explanation to ` +
      `open with one short bridging sentence that reconnects to the missed ` +
      `idea before teaching the new one — do not re-explain the old idea in ` +
      `full, just enough to link it, and do not make the section noticeably ` +
      `longer than it needs to be. The example may stay the same unless it ` +
      `would genuinely help to tweak it. No markdown.`,
    ADAPT_SCHEMA,
    config
  );

  return {
    adapted: result.adapted,
    explanation: result.explanation.trim(),
    example: result.example.trim(),
  };
}
