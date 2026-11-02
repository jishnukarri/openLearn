import "server-only";

import { chatJson, type ProviderConfig } from "./client";
import { buildTutorSystemPrompt, buildTutorUserPrompt, type CoachHistoryItem } from "@/lib/coach-prompt";

export type { CoachHistoryItem };

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

// Scoped coaching extras. lessonContext then holds ONLY the material up to
// the student's current step; nothing later is ever sent.
export type CoachScope = {
  coveredTopics: string[];
  studentSummary: string; // session + topic history, already token-capped
  currentStep: string; // the step on screen (answer withheld)
  lessonReference: string; // whole lesson, no check answers: the cached prefix
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
  config: ProviderConfig,
  scope?: CoachScope
): Promise<CoachTurn> {
  // Chat turns: stable cached prefix as `system`, small variable part as user.
  const result = scope
    ? await chatJson<CoachTurn>(
        buildTutorUserPrompt({
          currentStep: scope.currentStep,
          coveredContext: lessonContext,
          coveredTopics: scope.coveredTopics,
          studentSummary: scope.studentSummary,
          history,
          message,
        }),
        TUTOR_SCHEMA,
        config,
        { system: buildTutorSystemPrompt(topicName, subjectName, scope.lessonReference) }
      )
    : await chatJson<CoachTurn>(
        // Marking path (no lesson scope): a one-off prompt, not cached.
        `You are a friendly, sharp GCSE study coach working on "${topicName}" in ${subjectName}.\n` +
          `Material:\n${lessonContext}\n\n` +
          `Task: ${message}\n\n` +
          `Reply as JSON with kind "text", your answer in "reply", options [], correctIndex 0, explanation "". ` +
          `Plain English, no markdown.`,
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
