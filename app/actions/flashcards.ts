"use server";

import { getTopic, getSubtopic } from "@/lib/supabase/topics";
import { revalidatePath } from "next/cache";
import {
  getFlashcardsByTopic,
  getFlashcardsBySubtopic,
  createFlashcardSet,
  createFlashcardSetForSubtopic,
} from "@/lib/supabase/flashcards";
import { generateFlashcards, type FlashcardSet } from "@/lib/ai/flashcards";
import { resolveProviderConfig } from "@/lib/ai/client";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { requireAnyRole, requireOwnerOrAdmin } from "@/lib/appwrite/session";
import { withInFlight } from "@/lib/in-flight";
import { isDeckUsable } from "@/lib/flashcard-quality";
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

  // The subtopic comes from the client: it must belong to this topic.
  let subtopicKey: string | null = null;
  if (typeof subtopicId === "string" && subtopicId) {
    const subtopic = await getSubtopic(subtopicId);
    if (!subtopic || subtopic.topic.id !== topicId) throw new Error("Subtopic not found.");
    subtopicKey = subtopicId;
  }

  if (profile.role === "student") {
    // Students may only rebuild a deck that is currently too poor to show.
    if (topic.status !== "published") throw new Error("Topic not found.");
    const current = subtopicKey
      ? await getFlashcardsBySubtopic(subtopicKey)
      : await getFlashcardsByTopic(topicId);
    if (current && isDeckUsable(current.cards)) return;
  } else {
    await requireOwnerOrAdmin(topic.subject.id);
  }

  await withInFlight(`flashcards:${subtopicKey ?? topicId}`, async () => {
    const config = await resolveProviderConfig(profile.id);
    const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
    const generated = await generateFlashcards(topic.name, topic.subject.name, instructions, config);
    if (generated.cards.length === 0) throw new Error("Couldn't build good cards this time. Try again later.");
    if (subtopicKey) {
      await createFlashcardSetForSubtopic(topicId, subtopicKey, generated);
    } else {
      await createFlashcardSet(topicId, generated);
    }
  });
  revalidatePath(subtopicKey ? `/flashcards/subtopic/${subtopicKey}` : `/flashcards/${topicId}`);
}
