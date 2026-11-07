import "server-only";
import { filterCards } from "@/lib/flashcard-quality";
import type { FlashcardSet } from "@/lib/ai/flashcards";
import { db } from "./database-client";
import { getDeckForStudent, getStandardDeck, replaceStandardDeck } from "./flashcard-decks";

// The long-standing flashcard functions, now backed by decks (flashcard_decks +
// flashcards). They read and write a lesson's standard deck. Callers that know
// the student use the *ForStudent versions, which prefer the student's own deck.

const asSet = (cards: { front: string; back: string }[]): FlashcardSet => ({ cards: filterCards(cards) });

export async function getFlashcardsByTopic(topicId: string): Promise<FlashcardSet | null> {
  const deck = await getStandardDeck({ topicId });
  return deck ? asSet(deck.cards) : null;
}

export async function getFlashcardsBySubtopic(subtopicId: string, topicId?: string): Promise<FlashcardSet | null> {
  // The topic id is only needed to find the deck by lesson; look it up when the caller has not got it.
  const deck = await getStandardDeck({ topicId: topicId ?? (await topicOfSubtopic(subtopicId)), subtopicId });
  return deck ? asSet(deck.cards) : null;
}

export async function getFlashcardsForStudent(input: { studentId: string; topicId: string; subtopicId?: string | null }): Promise<FlashcardSet | null> {
  const deck = await getDeckForStudent(input);
  return deck ? asSet(deck.cards) : null;
}

export async function createFlashcardSet(topicId: string, set: FlashcardSet): Promise<void> {
  await replaceStandardDeck({ topicId }, set.cards);
}

export async function createFlashcardSetForSubtopic(topicId: string, subtopicId: string, set: FlashcardSet): Promise<void> {
  await replaceStandardDeck({ topicId, subtopicId }, set.cards);
}

async function topicOfSubtopic(subtopicId: string): Promise<string> {
  const { data, error } = await db.from("subtopics").select("topic_id").eq("id", subtopicId).maybeSingle();
  if (error) throw error;
  const id = (data as { topic_id?: string } | null)?.topic_id;
  if (!id) throw new Error("Subtopic not found.");
  return id;
}
