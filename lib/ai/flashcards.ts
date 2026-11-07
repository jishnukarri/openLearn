import "server-only";
import { filterCards } from "@/lib/flashcard-quality";
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
  config?: ProviderConfig,
  // What the lesson taught plus the spec wording (lib/grounding.ts), so the
  // cards test exactly that instead of whatever the topic name suggests.
  grounding?: string
): Promise<FlashcardSet> {
  const instructionNote = customInstructions
    ? `\n\nThe admin who set up this topic left these instructions — follow ` +
      `them: ${customInstructions}`
    : "";

  const generated = await chatJson<FlashcardSet>(
    `Write GCSE revision flashcards on "${topicName}" (subject: "${subjectName}"). ` +
      `Return up to 14 cards, and fewer (even none) rather than weak ones.\n\n` +
      `Rules:\n` +
      `- Only make a card for a discrete fact, term, or formula with a self-contained ` +
      `answer. Skip anything that is not card-shaped (processes narrated in prose, ` +
      `opinions, long explanations, context).\n` +
      `- Each card is either a term -> definition pair (front is the term only, ` +
      `1-4 words, back defines exactly that term) or a short question -> short answer ` +
      `pair (front ends with a question mark).\n` +
      `- Quote key terms exactly as the exam specification uses them.\n` +
      `- One idea per card. The back is at most 25 words and must make sense alone.\n` +
      `- Never use words that point at the lesson or surrounding text such as "this", ` +
      `"above", "below", "as shown", "the lesson". Never copy chopped-up sentences.\n` +
      `- Never repeat the front in the back as the whole answer, and never duplicate cards.\n` +
      `- Write plain prose, no markdown symbols. Use LaTeX ($...$) for mathematical notation.\n\n` +
      `Self-check each card before returning it: does the back answer exactly what the ` +
      `front asks, with no missing context? If not, fix or drop the card.${instructionNote}`,
    SCHEMA,
    config
  );
  return { cards: filterCards(generated.cards) };
}
