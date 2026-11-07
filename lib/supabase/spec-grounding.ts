import "server-only";
import { db } from "./database-client";
import { getSpecTextForBoard, getSpecTextForSubject } from "./subjects";
import { findSpecExcerpt } from "@/lib/spec-excerpt";
import { keyPointsFromLesson, renderGrounding } from "@/lib/grounding";
import type { LessonContent } from "@/lib/ai/lessons";

// The slice of the specification that covers a topic, or a subtopic inside it.
// Empty when the subject has no spec text or nothing in it matches. Never
// throws: grounding only ever adds to a prompt, it must not block generation.
export async function getSpecExcerpt(topicId: string, subtopicName?: string): Promise<string> {
  try {
    const { data } = await db
      .from("topics")
      .select("name, subject_id, exam_board_id")
      .eq("id", topicId)
      .maybeSingle();
    const topic = data as { name: string; subject_id: string; exam_board_id: string | null } | null;
    if (!topic) return "";
    const spec = topic.exam_board_id
      ? await getSpecTextForBoard(topic.subject_id, topic.exam_board_id)
      : await getSpecTextForSubject(topic.subject_id);
    if (!spec.trim()) return "";
    return findSpecExcerpt(spec, { name: subtopicName ?? topic.name, parentName: topic.name });
  } catch (e) {
    console.warn("[spec] could not find a spec excerpt:", e instanceof Error ? e.message : e);
    return "";
  }
}

export async function getSubtopicName(subtopicId: string): Promise<string | undefined> {
  const { data } = await db.from("subtopics").select("name").eq("id", subtopicId).maybeSingle();
  return (data as { name?: string } | null)?.name;
}

// The prompt block for a flashcard or exam-question generator: what the lesson
// for this topic or subtopic taught, plus the spec wording it was written
// against (stored with the lesson, or found now for lessons made before that).
export async function getGroundingBlock(input: { topicId: string; subtopicId?: string | null }): Promise<string> {
  try {
    let query = db
      .from("lessons")
      .select("content, spec_excerpt")
      .eq("topic_id", input.topicId)
      .order("created_at", { ascending: false })
      .limit(1);
    query = input.subtopicId ? query.eq("subtopic_id", input.subtopicId) : query.is("subtopic_id", null).is("class_id", null);
    const { data } = await query.maybeSingle();
    const row = data as { content: LessonContent; spec_excerpt: string | null } | null;
    const specExcerpt =
      row?.spec_excerpt ??
      (await getSpecExcerpt(input.topicId, input.subtopicId ? await getSubtopicName(input.subtopicId) : undefined));
    return renderGrounding({ keyPoints: keyPointsFromLesson(row?.content), specExcerpt });
  } catch (e) {
    console.warn("[spec] could not build grounding:", e instanceof Error ? e.message : e);
    return "";
  }
}
