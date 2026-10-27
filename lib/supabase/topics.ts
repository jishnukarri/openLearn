import "server-only";
import { db } from "./database-client";
import type { GeneratedTopic } from "@/lib/ai/topics";

export type Topic = {
  id: string;
  subject_id: string;
  exam_board_id: string | null;
  name: string;
  summary: string | null;
  status: "draft" | "published";
  position: number;
  custom_instructions: string | null;
};

export type Subtopic = {
  id: string;
  topic_id: string;
  name: string;
  status: "draft" | "published";
  position: number;
};

export async function listTopicsBySubject(subjectId: string): Promise<Topic[]> {
  const { data, error } = await db
    .from("topics")
    .select("id, subject_id, exam_board_id, name, summary, status, position, custom_instructions")
    .eq("subject_id", subjectId)
    .order("position");

  if (error) throw error;
  return data;
}

export async function listPublishedTopicsBySubject(
  subjectId: string,
  examBoardId?: string
): Promise<Topic[]> {
  let query = db
    .from("topics")
    .select("id, subject_id, exam_board_id, name, summary, status, position, custom_instructions")
    .eq("subject_id", subjectId)
    .eq("status", "published");

  if (examBoardId) {
    query = query.or(`exam_board_id.eq.${examBoardId},exam_board_id.is.null`);
  }

  const { data, error } = await query.order("position");
  if (error) throw error;
  return data;
}

export type TopicWithSubject = Topic & { subject: { id: string; name: string; archetype: string | null } };

export async function getTopic(topicId: string): Promise<TopicWithSubject | null> {
  const { data, error } = await db
    .from("topics")
    .select("id, subject_id, name, summary, status, position, custom_instructions, subjects(id, name, archetype)")
    .eq("id", topicId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { subjects, ...topic } = data as unknown as Topic & {
    subjects: TopicWithSubject["subject"];
  };
  return { ...topic, subject: subjects };
}

export async function createTopics(
  subjectId: string,
  topics: GeneratedTopic[],
  examBoardId?: string
): Promise<Topic[]> {

  const { data: startPos } = await db
    .from("topics")
    .select("position")
    .eq("subject_id", subjectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const offset = (startPos?.position ?? -1) + 1;

  const rows = topics.map((t, i) => {
    const row: Record<string, unknown> = {
      subject_id: subjectId,
      name: t.name,
      summary: t.summary,
      position: offset + i,
    };
    // Only set exam_board_id when explicitly provided — omitting it lets
    // Postgres use the column default (null) and avoids hitting a stale
    // PostgREST schema cache that doesn't know the column yet.
    if (examBoardId) row.exam_board_id = examBoardId;
    return row;
  });

  const { data: inserted, error } = await db
    .from("topics")
    .insert(rows)
    .select("id, subject_id, name, summary, status, position, custom_instructions");
  if (error) throw error;

  // Reconstruct exam_board_id from the known input rather than fetching it
  // back from PostgREST, so the SELECT above doesn't need to know the column.
  const insertedWithBoard: Topic[] = inserted.map((t) => ({
    ...t,
    exam_board_id: examBoardId ?? null,
  }));

  const subtopicRows = topics.flatMap((t, i) =>
    t.subtopics.map((name, j) => ({
      topic_id: insertedWithBoard[i].id,
      name,
      position: j,
    }))
  );

  if (subtopicRows.length > 0) {
    const { error: subtopicsError } = await db
      .from("subtopics")
      .insert(subtopicRows);
    if (subtopicsError) throw subtopicsError;
  }

  return insertedWithBoard;
}

// Admin-authored topic, no AI involved — for filling a gap the generator
// missed or covering something spec-specific by hand.
export async function createCustomTopic(input: {
  subjectId: string;
  examBoardId?: string;
  name: string;
  summary: string;
}): Promise<Topic> {

  const { data: startPos } = await db
    .from("topics")
    .select("position")
    .eq("subject_id", input.subjectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (startPos?.position ?? -1) + 1;

  const { data, error } = await db
    .from("topics")
    .insert({
      subject_id: input.subjectId,
      exam_board_id: input.examBoardId ?? null,
      name: input.name,
      summary: input.summary,
      position,
    })
    .select("id, subject_id, exam_board_id, name, summary, status, position, custom_instructions")
    .single();
  if (error) throw error;
  return data;
}

// "Generate All Topics" is meant to be re-runnable — clicking it again
// should replace the AI-drafted set, not pile duplicates on top. Only
// unpublished (draft) topics are cleared; a published topic is live for
// students, so it's left alone even if the admin regenerates around it.
// Deleting a topic cascades to its subtopics/lessons/questions in the DB.
export async function deleteDraftTopicsBySubject(subjectId: string): Promise<void> {
  const { error } = await db
    .from("topics")
    .delete()
    .eq("subject_id", subjectId)
    .eq("status", "draft");
  if (error) throw error;
}

export async function deleteDraftTopicsBySubjectAndBoard(
  subjectId: string,
  examBoardId: string
): Promise<void> {
  const { error } = await db
    .from("topics")
    .delete()
    .eq("subject_id", subjectId)
    .eq("exam_board_id", examBoardId)
    .eq("status", "draft");
  if (error) throw error;
}

export async function deleteTopic(topicId: string): Promise<void> {
  const { error } = await db.from("topics").delete().eq("id", topicId);
  if (error) throw error;
}

export async function deleteSubtopic(subtopicId: string): Promise<void> {
  const { error } = await db.from("subtopics").delete().eq("id", subtopicId);
  if (error) throw error;
}

export async function listSubtopicsByTopic(topicId: string): Promise<Subtopic[]> {
  const { data, error } = await db
    .from("subtopics")
    .select("id, topic_id, name, status, position")
    .eq("topic_id", topicId)
    .order("position");

  if (error) throw error;
  return data;
}

export async function listPublishedSubtopicsByTopic(topicId: string): Promise<Subtopic[]> {
  const { data, error } = await db
    .from("subtopics")
    .select("id, topic_id, name, status, position")
    .eq("topic_id", topicId)
    .eq("status", "published")
    .order("position");

  if (error) throw error;
  return data;
}

export type SubtopicWithTopic = Subtopic & { topic: TopicWithSubject };

// A subtopic plus everything a lesson/question/flashcard generator needs
// from its parent topic (subject name, custom instructions) — subtopics
// don't carry that info themselves.
export async function getSubtopic(subtopicId: string): Promise<SubtopicWithTopic | null> {
  const { data, error } = await db
    .from("subtopics")
    .select("id, topic_id, name, status, position, topics(id, subject_id, name, summary, status, position, custom_instructions, subjects(id, name, archetype))")
    .eq("id", subtopicId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { topics, ...subtopic } = data as unknown as Subtopic & {
    topics: TopicWithSubject & { subjects: { id: string; name: string; archetype: string | null } };
  };
  const { subjects, ...topic } = topics;
  return { ...subtopic, topic: { ...topic, subject: subjects } };
}

export async function updateTopicInstructions(
  topicId: string,
  instructions: string
): Promise<void> {
  const { error } = await db
    .from("topics")
    .update({ custom_instructions: instructions })
    .eq("id", topicId);
  if (error) throw error;
}

export async function updateTopic(topicId: string, input: { name: string; summary: string }): Promise<void> {
  const { error } = await db
    .from("topics")
    .update({ name: input.name, summary: input.summary })
    .eq("id", topicId);
  if (error) throw error;
}

export async function updateSubtopic(subtopicId: string, name: string): Promise<void> {
  const { error } = await db.from("subtopics").update({ name }).eq("id", subtopicId);
  if (error) throw error;
}

// Publishing a topic also publishes every subtopic under it — a topic isn't
// useful to a student half-published, and reviewing 8 subtopics one at a
// time before the topic itself is visible is just friction.
export async function publishTopic(topicId: string): Promise<void> {
  const { error } = await db
    .from("topics")
    .update({ status: "published" })
    .eq("id", topicId);
  if (error) throw error;

  const { error: subtopicsError } = await db
    .from("subtopics")
    .update({ status: "published" })
    .eq("topic_id", topicId);
  if (subtopicsError) throw subtopicsError;
}

export async function unpublishTopic(topicId: string): Promise<void> {
  const { error } = await db.from("topics").update({ status: "draft" }).eq("id", topicId);
  if (error) throw error;

  const { error: subtopicsError } = await db
    .from("subtopics")
    .update({ status: "draft" })
    .eq("topic_id", topicId);
  if (subtopicsError) throw subtopicsError;
}

export async function publishAllTopicsBySubject(subjectId: string): Promise<Topic[]> {
  const { data: topics, error } = await db
    .from("topics")
    .update({ status: "published" })
    .eq("subject_id", subjectId)
    .select("id, subject_id, exam_board_id, name, summary, status, position, custom_instructions");
  if (error) throw error;
  if (topics.length === 0) return [];

  const { error: subtopicsError } = await db
    .from("subtopics")
    .update({ status: "published" })
    .in(
      "topic_id",
      topics.map((t) => t.id)
    );
  if (subtopicsError) throw subtopicsError;

  return topics;
}

export async function publishSubtopic(subtopicId: string): Promise<void> {
  const { error } = await db
    .from("subtopics")
    .update({ status: "published" })
    .eq("id", subtopicId);
  if (error) throw error;
}

export async function unpublishSubtopic(subtopicId: string): Promise<void> {
  const { error } = await db
    .from("subtopics")
    .update({ status: "draft" })
    .eq("id", subtopicId);
  if (error) throw error;
}
