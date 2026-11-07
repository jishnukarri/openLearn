import "server-only";
import type { SubtopicWithTopic } from "@/lib/supabase/topics";
import { getLessonWithVersionBySubtopic, createLessonForSubtopic } from "@/lib/supabase/lessons";
import { isCurrentLesson } from "@/lib/lesson-version";
import {
  getQuestionForSubtopic,
  createQuestionForSubtopic,
  type Question,
} from "@/lib/supabase/questions";
import {
  getFlashcardsBySubtopic,
  createFlashcardSetForSubtopic,
} from "@/lib/supabase/flashcards";
import { generateLesson, type LessonContent } from "@/lib/ai/lessons";
import { generateQuestion } from "@/lib/ai/questions";
import { generateFlashcards, type FlashcardSet } from "@/lib/ai/flashcards";
import { resolveProviderConfig } from "@/lib/ai/client";
import { finalizeLessonContent } from "@/lib/lesson-finalize";
import { withReferenceContext } from "@/lib/rag";
import { getGroundingBlock } from "@/lib/supabase/spec-grounding";

// A subtopic is its own lesson unit — the generator gets the subtopic's own
// name (not the parent topic's), so "Ionisation Energy Trends" is taught as
// one focused lesson instead of being folded into a six-subtopic mega
// lesson under "Periodic Table: Structure and Trends". Reference documents
// (RAG) are still looked up by the *parent* topic id — that's where a
// teacher uploads them, and every subtopic under it should benefit.

// One generation per subtopic at a time, so two people opening the same
// outdated lesson share a single (paid) regeneration.
const generating = new Map<string, Promise<LessonContent>>();

export function resolveLessonForSubtopic(
  subtopic: SubtopicWithTopic,
  studentId: string
): Promise<LessonContent> {
  const running = generating.get(subtopic.id);
  if (running) return running;
  const p = resolveLessonForSubtopicUncached(subtopic, studentId).finally(() => {
    if (generating.get(subtopic.id) === p) generating.delete(subtopic.id);
  });
  generating.set(subtopic.id, p);
  return p;
}

async function resolveLessonForSubtopicUncached(
  subtopic: SubtopicWithTopic,
  studentId: string
): Promise<LessonContent> {
  const stored = await getLessonWithVersionBySubtopic(subtopic.id);
  const usable = !!stored && !!stored.content.sections[0]?.check;
  if (stored && usable && isCurrentLesson(stored.version)) return stored.content;

  // Missing or from an older lesson format: regenerate and replace it (the
  // newest row wins), falling back to the old lesson if generation fails.
  try {
    const config = await resolveProviderConfig(studentId);
    const instructions = await withReferenceContext(
      subtopic.topic.id,
      subtopic.name,
      subtopic.topic.custom_instructions
    );
    const generated = await generateLesson(subtopic.name, subtopic.topic.subject.name, false, instructions, config);
    const finalized = await finalizeLessonContent(generated, subtopic.id, subtopic.topic.subject.name);
    await createLessonForSubtopic(subtopic.topic.id, subtopic.id, finalized);
    return finalized;
  } catch (e) {
    if (stored && usable) {
      console.warn("[lessons] could not upgrade an older lesson, showing it as it is:", e instanceof Error ? e.message : e);
      return stored.content;
    }
    throw e;
  }
}

export async function resolveQuestionForSubtopic(
  subtopic: SubtopicWithTopic,
  studentId: string,
  opts?: { force?: boolean }
): Promise<Question> {
  if (!opts?.force) {
    const existing = await getQuestionForSubtopic(subtopic.id);
    if (existing) return existing;
  }

  const config = await resolveProviderConfig(studentId);
  const instructions = await withReferenceContext(
    subtopic.topic.id,
    subtopic.name,
    subtopic.topic.custom_instructions
  );
  const grounding = await getGroundingBlock({ topicId: subtopic.topic.id, subtopicId: subtopic.id });
  const generated = await generateQuestion(subtopic.name, subtopic.topic.subject.name, instructions, config, grounding);
  return createQuestionForSubtopic(subtopic.topic.id, subtopic.id, generated);
}

export async function resolveFlashcardsForSubtopic(
  subtopic: SubtopicWithTopic,
  studentId: string
): Promise<FlashcardSet> {
  const existing = await getFlashcardsBySubtopic(subtopic.id);
  if (existing) return existing;

  const config = await resolveProviderConfig(studentId);
  const instructions = await withReferenceContext(
    subtopic.topic.id,
    subtopic.name,
    subtopic.topic.custom_instructions
  );
  const grounding = await getGroundingBlock({ topicId: subtopic.topic.id, subtopicId: subtopic.id });
  const generated = await generateFlashcards(subtopic.name, subtopic.topic.subject.name, instructions, config, grounding);
  await createFlashcardSetForSubtopic(subtopic.topic.id, subtopic.id, generated);
  return generated;
}
