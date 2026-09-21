import "server-only";
import { createServiceClient } from "./server";
import type { LessonContent } from "@/lib/ai/lessons";

// classId omitted/null = the shared, topic-wide lesson every self-study
// student sees. A non-null classId is a fork generated for that class only
// (see lib/class-content.ts) — never falls back across classes.
export async function getLessonByTopic(
  topicId: string,
  classId?: string | null
): Promise<LessonContent | null> {
  const supabase = createServiceClient();
  let query = supabase
    .from("lessons")
    .select("content")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(1);
  query = classId ? query.eq("class_id", classId) : query.is("class_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? (data.content as LessonContent) : null;
}

export async function createLesson(
  topicId: string,
  content: LessonContent,
  classId?: string | null
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("lessons")
    .insert({ topic_id: topicId, content, class_id: classId ?? null });
  if (error) throw error;
}

// A subtopic's own lesson — kept separate from getLessonByTopic/createLesson
// (rather than overloading them) so the shared topic-wide lesson and a
// subtopic's lesson can never be confused for one another.
export async function getLessonBySubtopic(subtopicId: string): Promise<LessonContent | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("content")
    .eq("subtopic_id", subtopicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.content as LessonContent) : null;
}

export async function createLessonForSubtopic(
  topicId: string,
  subtopicId: string,
  content: LessonContent
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("lessons")
    .insert({ topic_id: topicId, subtopic_id: subtopicId, content });
  if (error) throw error;
}
