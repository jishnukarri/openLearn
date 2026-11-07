"use server";

import { getTopic, getSubtopic } from "@/lib/supabase/topics";
import { revalidatePath } from "next/cache";
import {
  getFlashcardsByTopic,
  getFlashcardsBySubtopic,
  getFlashcardsForStudent,
  createFlashcardSet,
  createFlashcardSetForSubtopic,
} from "@/lib/supabase/flashcards";
import { generateFlashcards, type FlashcardSet } from "@/lib/ai/flashcards";
import { resolveProviderConfig } from "@/lib/ai/client";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { requireAnyRole, requireOwnerOrAdmin } from "@/lib/appwrite/session";
import { withInFlight } from "@/lib/in-flight";
import { isDeckUsable } from "@/lib/flashcard-quality";
import { getGroundingBlock } from "@/lib/supabase/spec-grounding";
import { withReferenceContext } from "@/lib/rag";

// Get-or-generate, same lazy pattern as lessons/questions — a topic's
// flashcards are generated once on first visit and reused after that.
export async function resolveFlashcards(topicId: string): Promise<FlashcardSet> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);

  // The student's own deck for this lesson if they have one, else the standard deck.
  const existing = await getFlashcardsForStudent({ studentId: profile.id, topicId });
  if (existing) return existing;

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
  const grounding = await getGroundingBlock({ topicId });
  const generated = await generateFlashcards(topic.name, topic.subject.name, instructions, config, grounding);
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
  let subtopicName: string | null = null;
  if (typeof subtopicId === "string" && subtopicId) {
    const subtopic = await getSubtopic(subtopicId);
    if (!subtopic || subtopic.topic.id !== topicId) throw new Error("Subtopic not found.");
    subtopicKey = subtopicId;
    subtopicName = subtopic.name;
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
    // A subtopic deck is about the subtopic, not the whole topic around it.
    const subject = subtopicName ?? topic.name;
    const instructions = await withReferenceContext(topicId, subject, topic.custom_instructions);
    const grounding = await getGroundingBlock({ topicId, subtopicId: subtopicKey });
    const generated = await generateFlashcards(subject, topic.subject.name, instructions, config, grounding);
    if (generated.cards.length === 0) throw new Error("Couldn't build good cards this time. Try again later.");
    if (subtopicKey) {
      await createFlashcardSetForSubtopic(topicId, subtopicKey, generated);
    } else {
      await createFlashcardSet(topicId, generated);
    }
  });
  revalidatePath(subtopicKey ? `/flashcards/subtopic/${subtopicKey}` : `/flashcards/${topicId}`);
}


/* ── Decks: a student's own, extra practice, choosing, sharing ───────────── */

import { createPersonalDeck, createExtraDeck, canOfferExtraDeck, type DeckLesson } from "@/lib/flashcard-service";
import {
  addSharedDeck,
  archiveDeck,
  clearStudentDeckChoice,
  getDeckById,
  setStudentDeckChoice,
  shareDeck,
  unshareDeck,
} from "@/lib/supabase/flashcard-decks";
import { isUuid } from "@/lib/uuid";
import { isShareToken } from "@/lib/flashcard-decks";
import { requireRole } from "@/lib/appwrite/session";

// The lesson a deck action is about, from the form: a topic, or a subtopic of it.
// Students only reach published topics, and a subtopic must belong to its topic.
async function lessonFromForm(formData: FormData): Promise<DeckLesson> {
  const topicId = formData.get("topicId");
  const subtopicId = formData.get("subtopicId");
  if (!isUuid(topicId)) throw new Error("Missing topic.");
  const topic = await getTopic(topicId);
  if (!topic || topic.status !== "published") throw new Error("Topic not found.");
  if (typeof subtopicId === "string" && subtopicId) {
    const subtopic = await getSubtopic(subtopicId);
    if (!subtopic || subtopic.topic.id !== topicId) throw new Error("Subtopic not found.");
    return { topicId, subtopicId, name: subtopic.name, subjectName: topic.subject.name, topicCustomInstructions: topic.custom_instructions };
  }
  return { topicId, name: topic.name, subjectName: topic.subject.name, topicCustomInstructions: topic.custom_instructions };
}

const decksPath = (l: DeckLesson) => (l.subtopicId ? `/flashcards/subtopic/${l.subtopicId}` : `/flashcards/${l.topicId}`);

// "Make me my own deck": a fresh set for this lesson, theirs alone, switched on.
export async function createPersonalDeckAction(formData: FormData): Promise<{ deckId: string }> {
  const { profile } = await requireRole("student");
  if (!(await checkKeyRateLimit("flashcard-deck", profile.id, 5, 10 * 60_000))) {
    throw new Error("Please wait a few minutes before making another deck.");
  }
  const lesson = await lessonFromForm(formData);
  const deckId = await withInFlight(`deck:${profile.id}:${lesson.subtopicId ?? lesson.topicId}`, () =>
    createPersonalDeck({ ...lesson, studentId: profile.id })
  );
  revalidatePath(decksPath(lesson));
  return { deckId };
}

// Whether this student may be offered the extra practice set for a lesson.
export async function extraDeckAvailableAction(formData: FormData): Promise<boolean> {
  const { profile } = await requireRole("student");
  const lesson = await lessonFromForm(formData);
  return canOfferExtraDeck({ studentId: profile.id, topicId: lesson.topicId, subtopicId: lesson.subtopicId });
}

export async function createExtraDeckAction(formData: FormData): Promise<{ deckId: string }> {
  const { profile } = await requireRole("student");
  if (!(await checkKeyRateLimit("flashcard-deck", profile.id, 5, 10 * 60_000))) {
    throw new Error("Please wait a few minutes before making another deck.");
  }
  const lesson = await lessonFromForm(formData);
  const deckId = await withInFlight(`deck:${profile.id}:${lesson.subtopicId ?? lesson.topicId}`, () =>
    createExtraDeck({ ...lesson, studentId: profile.id })
  );
  revalidatePath(decksPath(lesson));
  return { deckId };
}

// Switch which deck a student uses for a lesson: one of their own, or back to the standard one.
export async function chooseDeckAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");
  const lesson = await lessonFromForm(formData);
  const deckId = formData.get("deckId");
  if (deckId === "standard" || !deckId) {
    await clearStudentDeckChoice({ ...lesson, studentId: profile.id });
  } else {
    const deck = isUuid(deckId) ? await getDeckById(deckId) : null;
    if (!deck || deck.ownerId !== profile.id || deck.archivedAt || deck.topicId !== lesson.topicId || (deck.subtopicId ?? null) !== (lesson.subtopicId ?? null)) {
      throw new Error("Deck not found.");
    }
    await setStudentDeckChoice({ ...lesson, studentId: profile.id, deckId: deck.id });
  }
  revalidatePath(decksPath(lesson));
}

export async function deleteDeckAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");
  const deckId = formData.get("deckId");
  if (!isUuid(deckId)) throw new Error("Deck not found.");
  const deck = await getDeckById(deckId);
  if (!deck || deck.ownerId !== profile.id) throw new Error("Deck not found.");
  await archiveDeck(deck.id, profile.id);
  revalidatePath(deck.subtopicId ? `/flashcards/subtopic/${deck.subtopicId}` : `/flashcards/${deck.topicId}`);
}

// Sharing: returns a link path anyone signed in can open. The owner can switch it off.
export async function shareDeckAction(formData: FormData): Promise<{ path: string }> {
  const { profile } = await requireRole("student");
  const deckId = formData.get("deckId");
  if (!isUuid(deckId)) throw new Error("Deck not found.");
  const token = await shareDeck(deckId, profile.id);
  return { path: `/flashcards/shared/${token}` };
}

export async function unshareDeckAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");
  const deckId = formData.get("deckId");
  if (!isUuid(deckId)) throw new Error("Deck not found.");
  await unshareDeck(deckId, profile.id);
}

// Someone opens a share link and adds the deck: they get their own copy.
export async function addSharedDeckAction(formData: FormData): Promise<{ deckId: string }> {
  const { profile } = await requireRole("student");
  const token = formData.get("token");
  if (!isShareToken(token)) throw new Error("This link isn't valid.");
  if (!(await checkKeyRateLimit("flashcard-share-add", profile.id, 20, 10 * 60_000))) {
    throw new Error("Please wait a few minutes.");
  }
  const deckId = await addSharedDeck({ token, studentId: profile.id });
  if (!deckId) throw new Error("This deck isn't shared any more.");
  return { deckId };
}
