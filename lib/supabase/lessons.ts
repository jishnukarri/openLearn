import "server-only";
import { db } from "./database-client";
import type { LessonContent } from "@/lib/ai/lessons";
import { LESSON_VERSION } from "@/lib/lesson-version";
import { getSpecExcerpt, getSubtopicName } from "./spec-grounding";
import { getStandardDeck } from "./flashcard-decks";

export type StoredLesson = { content: LessonContent; version: number };

// classId omitted/null = the shared, topic-wide lesson every self-study
// student sees. A non-null classId is a fork generated for that class only
// (see lib/class-content.ts) — never falls back across classes.
export async function getLessonWithVersion(
  topicId: string,
  classId?: string | null
): Promise<StoredLesson | null> {
  let query = db
    .from("lessons")
    .select("content, version")
    .eq("topic_id", topicId)
    .is("subtopic_id", null)
    .order("created_at", { ascending: false })
    .limit(1);
  query = classId ? query.eq("class_id", classId) : query.is("class_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? { content: data.content as LessonContent, version: data.version ?? 1 } : null;
}

export async function getLessonByTopic(
  topicId: string,
  classId?: string | null
): Promise<LessonContent | null> {
  return (await getLessonWithVersion(topicId, classId))?.content ?? null;
}

export async function createLesson(
  topicId: string,
  content: LessonContent,
  classId?: string | null
): Promise<void> {
  const { error } = await db
    .from("lessons")
    .insert({
      topic_id: topicId,
      content,
      class_id: classId ?? null,
      version: LESSON_VERSION,
      // The part of the spec this lesson was written against, kept so the exam
      // questions and flashcards made later use the same wording.
      spec_excerpt: (await getSpecExcerpt(topicId)) || null,
      // The lesson's standard flashcard deck, if it has one yet.
      deck_id: (await getStandardDeck({ topicId }))?.id ?? null,
    });
  if (error) throw error;
}

// A subtopic's own lesson — kept separate from getLessonByTopic/createLesson
// (rather than overloading them) so the shared topic-wide lesson and a
// subtopic's lesson can never be confused for one another.
export async function getLessonWithVersionBySubtopic(subtopicId: string): Promise<StoredLesson | null> {
  const { data, error } = await db
    .from("lessons")
    .select("content, version")
    .eq("subtopic_id", subtopicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { content: data.content as LessonContent, version: data.version ?? 1 } : null;
}

export async function getLessonBySubtopic(subtopicId: string): Promise<LessonContent | null> {
  return (await getLessonWithVersionBySubtopic(subtopicId))?.content ?? null;
}

export async function createLessonForSubtopic(
  topicId: string,
  subtopicId: string,
  content: LessonContent
): Promise<void> {
  const { error } = await db
    .from("lessons")
    .insert({
      topic_id: topicId,
      subtopic_id: subtopicId,
      content,
      version: LESSON_VERSION,
      spec_excerpt: (await getSpecExcerpt(topicId, await getSubtopicName(subtopicId))) || null,
      deck_id: (await getStandardDeck({ topicId, subtopicId }))?.id ?? null,
    });
  if (error) throw error;
}
