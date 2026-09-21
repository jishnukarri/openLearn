"use server";

import { getTopic } from "@/lib/supabase/topics";
import { getFlashcardsByTopic, createFlashcardSet } from "@/lib/supabase/flashcards";
import { generateFlashcards, type FlashcardSet } from "@/lib/ai/flashcards";
import { resolveProviderConfig } from "@/lib/ai/client";
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
  const { profile } = await requireAnyRole(["teacher", "admin"]);
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
  const generated = await generateFlashcards(topic.name, topic.subject.name, instructions, config);
  await createFlashcardSet(topicId, generated);
}
