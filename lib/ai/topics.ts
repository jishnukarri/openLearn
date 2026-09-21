import "server-only";
import { chatJson, type ProviderConfig } from "./client";

export type GeneratedTopic = {
  name: string;
  summary: string;
  subtopics: string[];
};

const SCHEMA = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          summary: { type: "string" },
          subtopics: { type: "array", items: { type: "string" } },
        },
        required: ["name", "summary", "subtopics"],
      },
    },
  },
  required: ["topics"],
};

export async function generateTopicsForSubject(
  subjectName: string,
  examBoardNames: string[],
  specText?: string,
  customInstructions?: string,
  config?: ProviderConfig
): Promise<GeneratedTopic[]> {
  const grounding = specText
    ? `Base this strictly on the official spec text below — use its own ` +
      `topic/unit names and structure where possible, don't invent topics ` +
      `it doesn't cover.\n\nSPEC:\n${specText}`
    : `No official spec text was provided, so use your trained knowledge of ` +
      `the ${examBoardNames.join(", ") || "general UK GCSE"} specification.`;

  const instructionNote = customInstructions
    ? `\n\nThe admin who set this subject up left these instructions — follow ` +
      `them: ${customInstructions}`
    : "";

  const result = await chatJson<{ topics: GeneratedTopic[] }>(
    `List the core GCSE topics for "${subjectName}" ` +
      `(exam boards: ${examBoardNames.join(", ") || "general UK GCSE"}). ${grounding} ` +
      `Cover the full syllabus breadth, ordered the way a student would ` +
      `progress through the course. For each topic, also break it into ` +
      `3-8 specific subtopics (short guide-style titles, the way a student ` +
      `would see them in a checklist).${instructionNote}`,
    SCHEMA,
    config
  );

  return result.topics;
}

const SINGLE_SCHEMA = {
  type: "object",
  properties: {
    topic: {
      type: "object",
      properties: {
        name: { type: "string" },
        summary: { type: "string" },
        subtopics: { type: "array", items: { type: "string" } },
      },
      required: ["name", "summary", "subtopics"],
    },
  },
  required: ["topic"],
};

// Generates one additional topic, either around a hint the admin typed
// ("Isotopes") or, with no hint, whatever the model judges is the next
// sensible gap in the subject's existing topic list.
export async function generateSingleTopic(
  subjectName: string,
  examBoardNames: string[],
  existingTopicNames: string[],
  hint?: string,
  customInstructions?: string,
  config?: ProviderConfig
): Promise<GeneratedTopic> {
  const existingNote =
    existingTopicNames.length > 0
      ? `\n\nTopics already covered (don't duplicate): ${existingTopicNames.join(", ")}.`
      : "";
  const hintNote = hint
    ? `The new topic should be about: "${hint}".`
    : `Pick whatever topic is the most obviously missing gap in the ` +
      `syllabus given what's already covered.`;
  const instructionNote = customInstructions
    ? `\n\nThe admin who set this subject up left these instructions — follow ` +
      `them: ${customInstructions}`
    : "";

  const result = await chatJson<{ topic: GeneratedTopic }>(
    `Generate ONE new GCSE topic for "${subjectName}" ` +
      `(exam boards: ${examBoardNames.join(", ") || "general UK GCSE"}). ${hintNote}${existingNote} ` +
      `Break it into 3-8 specific subtopics (short guide-style titles, the ` +
      `way a student would see them in a checklist).${instructionNote}`,
    SINGLE_SCHEMA,
    config
  );

  return result.topic;
}
