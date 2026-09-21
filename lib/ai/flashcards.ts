import "server-only";
import { chatJson, type ProviderConfig } from "./client";

export type Flashcard = { front: string; back: string };
export type FlashcardSet = { cards: Flashcard[] };

const SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          front: { type: "string" },
          back: { type: "string" },
        },
        required: ["front", "back"],
      },
    },
  },
  required: ["cards"],
};

export async function generateFlashcards(
  topicName: string,
  subjectName: string,
  customInstructions?: string,
  config?: ProviderConfig
): Promise<FlashcardSet> {
  const instructionNote = customInstructions
    ? `\n\nThe admin who set up this topic left these instructions — follow ` +
      `them: ${customInstructions}`
    : "";

  return chatJson<FlashcardSet>(
    `Write a set of 10-14 GCSE revision flashcards on "${topicName}" ` +
      `(subject: "${subjectName}"). Each card's "front" is a short question, ` +
      `term, or prompt (one line); the "back" is the concise answer or ` +
      `definition (1-2 sentences max — flashcards are for quick recall, not ` +
      `explanations). Cover the key facts, definitions, and terms a student ` +
      `would need to recall instantly in an exam. Write all text as plain ` +
      `prose — no markdown symbols. Use LaTeX ($...$) for any mathematical ` +
      `notation.${instructionNote}`,
    SCHEMA,
    config
  );
}
