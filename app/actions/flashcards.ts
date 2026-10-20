"use server";

import { getTopic } from "@/lib/supabase/topics";
import { revalidatePath } from "next/cache";
import { getFlashcardsByTopic, createFlashcardSet, createFlashcardSetForSubtopic } from "@/lib/supabase/flashcards";
import { generateFlashcards, type FlashcardSet } from "@/lib/ai/flashcards";
import { resolveProviderConfig } from "@/lib/ai/client";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { requireAnyRole } from "@/lib/appwrite/session";
import { withReferenceContext } from "@/lib/rag";

// Get-or-generate, same lazy pattern as lessons/questions — a topic's
// flashcards are generated once on first visit and reused after that.
export async function resolveFlashcards(topicId: string): Promise<FlashcardSet> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);

  const existing = await getFlashcardsByTopic(topicId);
  if (existing) return existing;

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
  const generated = await generateFlashcards(topic.name, topic.subject.name, instructions, config);
  await createFlashcardSet(topicId, generated);
  return generated;
}

export async function regenerateFlashcardsAction(formData: FormData): Promise<void> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (!(await checkKeyRateLimit("flashcard-rebuild", profile.id, 3, 10 * 60_000))) {
    throw new Error("Please wait a few minutes before rebuilding again.");
  }
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");
  const subtopicId = formData.get("subtopicId");

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
  const generated = await generateFlashcards(topic.name, topic.subject.name, instructions, config);
  if (generated.cards.length === 0) throw new Error("Couldn't build good cards this time. Try again later.");
  if (typeof subtopicId === "string" && subtopicId) {
    await createFlashcardSetForSubtopic(topicId, subtopicId, generated);
    revalidatePath(`/flashcards/subtopic/${subtopicId}`);
  } else {
    await createFlashcardSet(topicId, generated);
    revalidatePath(`/flashcards/${topicId}`);
  }
}
