import "server-only";
import { db } from "@/lib/supabase/database-client";
import { generateFlashcards } from "@/lib/ai/flashcards";
import { resolveProviderConfig } from "@/lib/ai/client";
import { withReferenceContext } from "@/lib/rag";
import { getGroundingBlock } from "@/lib/supabase/spec-grounding";
import {
  addStudentDeck,
  getDeckForStudent,
  getStandardDeck,
  replaceStandardDeck,
} from "@/lib/supabase/flashcard-decks";
import { avoidFronts, remedialBlock, remedialEligible, variationBlock, type MissedIdea } from "@/lib/flashcard-decks";

// Making decks: the standard deck that goes with a lesson, a student's own
// regenerated deck, and the extra set for a student who is struggling. All of
// them are grounded in what the lesson taught and the spec wording (see
// lib/grounding.ts), so the cards match the lesson.

export type DeckLesson = {
  topicId: string;
  subtopicId?: string | null;
  // What the lesson is called, and its subject: the subtopic's own name for a subtopic lesson.
  name: string;
  subjectName: string;
  topicCustomInstructions?: string | null;
};

async function generate(input: DeckLesson, profileId: string | null, extra: string) {
  const config = await resolveProviderConfig(profileId);
  const instructions = await withReferenceContext(input.topicId, input.name, input.topicCustomInstructions);
  const grounding = await getGroundingBlock({ topicId: input.topicId, subtopicId: input.subtopicId });
  return generateFlashcards(input.name, input.subjectName, instructions, config, `${grounding}${extra}`);
}

// When a lesson is regenerated into a newer format, its standard deck is rebuilt
// from the new lesson so the cards keep matching it. Only when the lesson already
// had a deck (decks for lessons that never had one still appear on first visit).
// Never throws: a failed rebuild leaves the old deck in place.
export async function refreshStandardDeck(input: DeckLesson, profileId: string | null): Promise<void> {
  try {
    if (!(await getStandardDeck(input))) return;
    const set = await generate(input, profileId, "");
    if (set.cards.length > 0) await replaceStandardDeck(input, set.cards);
  } catch (e) {
    console.warn("[decks] could not refresh the standard deck:", e instanceof Error ? e.message : e);
  }
}

// A student's own deck for a lesson: a fresh set that avoids repeating the deck
// they have now, made theirs and switched on for this lesson only.
export async function createPersonalDeck(input: DeckLesson & { studentId: string }): Promise<string> {
  const current = await getDeckForStudent(input);
  const set = await generate(input, input.studentId, variationBlock(avoidFronts(current?.cards ?? [])));
  if (set.cards.length === 0) throw new Error("Couldn't build good cards this time. Try again in a moment.");
  return addStudentDeck({
    kind: "personal",
    studentId: input.studentId,
    topicId: input.topicId,
    subtopicId: input.subtopicId,
    cards: set.cards,
    title: `My ${input.name} deck`,
  });
}

// The questions in this lesson the student got wrong and has not yet got right.
export async function getUnresolvedMisses(input: { studentId: string; topicId: string; subtopicId?: string | null }): Promise<MissedIdea[]> {
  let q = db
    .from("lesson_check_misses")
    .select("prompt, correct_answer")
    .eq("student_id", input.studentId)
    .eq("topic_id", input.topicId)
    .eq("resolved", false)
    .order("last_missed_at", { ascending: false })
    .limit(20);
  if (input.subtopicId) q = q.eq("subtopic_id", input.subtopicId);
  const { data, error } = await q;
  if (error) return []; // the misses table is optional; no misses means no extra deck is offered
  return ((data ?? []) as { prompt: string; correct_answer: string | null }[]).map((r) => ({
    prompt: r.prompt,
    correctAnswer: r.correct_answer ?? "",
  }));
}

export async function canOfferExtraDeck(input: { studentId: string; topicId: string; subtopicId?: string | null }): Promise<boolean> {
  return remedialEligible((await getUnresolvedMisses(input)).length);
}

// The extra set: cards that close the specific gaps the student showed. It sits
// alongside the standard deck (a new one replaces the previous extra set).
export async function createExtraDeck(input: DeckLesson & { studentId: string }): Promise<string> {
  const misses = await getUnresolvedMisses(input);
  if (!remedialEligible(misses.length)) throw new Error("There is nothing to practise yet. Finish the lesson's questions first.");
  const set = await generate(input, input.studentId, remedialBlock(misses));
  if (set.cards.length === 0) throw new Error("Couldn't build good cards this time. Try again in a moment.");
  return addStudentDeck({
    kind: "remedial",
    studentId: input.studentId,
    topicId: input.topicId,
    subtopicId: input.subtopicId,
    cards: set.cards,
    title: `Extra practice: ${input.name}`,
  });
}
