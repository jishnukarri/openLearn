import "server-only";

import { chatJson, type ProviderConfig } from "./client";

const TUTOR_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["text", "mcq", "question"] },
    reply: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    correctIndex: { type: "number" },
    explanation: { type: "string" },
  },
  required: ["kind", "reply", "options", "correctIndex", "explanation"],
};

export type CoachTurn = {
  kind: "text" | "mcq" | "question";
  reply: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type CoachHistoryItem = { role: "student" | "coach"; text: string };

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    explanation: { type: "string" },
    example: { type: "string" },
  },
  required: ["reply", "explanation", "example"],
};

// One turn of the study coach. It can answer, explain, hint, set a
// multiple-choice question (kind "mcq", marked in the browser), or ask a
// direct question the student types an answer to (kind "question"; their
// next message arrives as the answer and is marked via the history).
export async function askLessonTutor(
  topicName: string,
  subjectName: string,
  lessonContext: string,
  history: CoachHistoryItem[],
  message: string,
  config: ProviderConfig
): Promise<CoachTurn> {
  const transcript = history
    .slice(-8)
    .map((h) => `${h.role === "student" ? "Student" : "Coach"}: ${h.text}`)
    .join("\n");

  const result = await chatJson<CoachTurn>(
    `You are a friendly, sharp GCSE study coach. The student is working ` +
      `through a lesson on "${topicName}" in ${subjectName}. The step on ` +
      `screen is:\n${lessonContext}\n\n` +
      (transcript ? `Conversation so far:\n${transcript}\n\n` : "") +
      `Student now says: "${message}"\n\n` +
      `Do not penalise spelling, grammar or punctuation, except where a key scientific term is misspelled so that it becomes a different or ambiguous term.\n\n` +
      `Reply as JSON. Choose "kind":\n` +
      `- "mcq": when they ask to be quizzed or tested, or want a multiple ` +
      `choice question. Write one question about THIS step in "reply", 4 ` +
      `plausible options in "options", the right one's 0-based "correctIndex", ` +
      `and a 1-2 sentence "explanation" of why it is right.\n` +
      `- "question": when they ask you to ask them something. Put one ` +
      `direct, answerable question about this step in "reply" (options: [], ` +
      `correctIndex: 0, explanation: ""). Their next message is their answer: ` +
      `tell them if it is right, correct any mistake kindly, and say what ` +
      `the full answer is.\n` +
      `- "text": for everything else (explain, hint, their own question).\n\n` +
      `Rules: stay at GCSE level and within what the step teaches (no A-level ` +
      `ideas such as E=mc^2); questions must have one clearly correct answer. ` +
      `Never ask the student to clarify what to explain; just explain ` +
      `the step shown, in simpler words with an everyday example. "Check my ` +
      `understanding" means ask a direct question (kind "question"). A hint ` +
      `is one useful nudge that does not reveal the answer. Use plain ` +
      `English, 2-4 short sentences for text, no markdown, headings or ` +
      `lists. For "text" and "question" set options to [], correctIndex 0 ` +
      `and explanation "" unless told otherwise.`,
    TUTOR_SCHEMA,
    config
  );

  const kind = result.kind === "mcq" && (result.options?.length ?? 0) >= 2 ? "mcq" : result.kind === "question" ? "question" : "text";
  return {
    kind,
    reply: (result.reply ?? "").trim(),
    options: kind === "mcq" ? result.options.map((o) => String(o).trim()) : [],
    correctIndex: kind === "mcq" ? Math.min(Math.max(0, Math.round(result.correctIndex ?? 0)), result.options.length - 1) : 0,
    explanation: (result.explanation ?? "").trim(),
  };
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
