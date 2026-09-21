import "server-only";
import { db } from "./database-client";
import type { FlashcardSet } from "@/lib/ai/flashcards";

export async function getFlashcardsByTopic(topicId: string): Promise<FlashcardSet | null> {
  const { data, error } = await db
    .from("flashcard_sets")
    .select("cards")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { cards: data.cards as FlashcardSet["cards"] } : null;
}

export async function createFlashcardSet(topicId: string, set: FlashcardSet): Promise<void> {
  const { error } = await db
    .from("flashcard_sets")
    .insert({ topic_id: topicId, cards: set.cards });
  if (error) throw error;
}

export async function getFlashcardsBySubtopic(subtopicId: string): Promise<FlashcardSet | null> {
  const { data, error } = await db
    .from("flashcard_sets")
    .select("cards")
    .eq("subtopic_id", subtopicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { cards: data.cards as FlashcardSet["cards"] } : null;
}

export async function createFlashcardSetForSubtopic(
  topicId: string,
  subtopicId: string,
  set: FlashcardSet
): Promise<void> {
  const { error } = await db
    .from("flashcard_sets")
    .insert({ topic_id: topicId, subtopic_id: subtopicId, cards: set.cards });
  if (error) throw error;
}
