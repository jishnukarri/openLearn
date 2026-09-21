import "server-only";
import { db } from "./database-client";

// Marks a topic complete for the path page — idempotent (a repeat lesson
// completion just no-ops the second time).
export async function markTopicComplete(studentId: string, topicId: string): Promise<void> {
  const { error } = await db
    .from("topic_completions")
    .upsert({ student_id: studentId, topic_id: topicId }, { onConflict: "student_id,topic_id" });
  if (error) throw error;
}

export async function markSubtopicComplete(studentId: string, subtopicId: string): Promise<void> {
  const { error } = await db
    .from("subtopic_completions")
    .upsert({ student_id: studentId, subtopic_id: subtopicId }, { onConflict: "student_id,subtopic_id" });
  if (error) throw error;
}

export async function getCompletedSubtopicIds(studentId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("subtopic_completions")
    .select("subtopic_id")
    .eq("student_id", studentId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.subtopic_id as string));
}

export async function isTopicCompleted(studentId: string, topicId: string): Promise<boolean> {
  const { data } = await db
    .from("topic_completions")
    .select("topic_id")
    .eq("student_id", studentId)
    .eq("topic_id", topicId)
    .maybeSingle();
  return data !== null;
}

export async function getCompletedTopicIds(studentId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("topic_completions")
    .select("topic_id")
    .eq("student_id", studentId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.topic_id as string));
}

// XP per mark, plus a streak bump — called once per submitted answer.
export async function awardXp(profileId: string, marksAwarded: number): Promise<void> {
  const { data: profile, error: fetchError } = await db
    .from("profiles")
    .select("xp, streak_count, last_active_date")
    .eq("id", profileId)
    .single();
  if (fetchError) throw fetchError;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let streak = profile.streak_count;
  if (profile.last_active_date !== today) {
    streak = profile.last_active_date === yesterday ? streak + 1 : 1;
  }

  const { error: updateError } = await db
    .from("profiles")
    .update({
      xp: profile.xp + marksAwarded * 10,
      streak_count: streak,
      last_active_date: today,
    })
    .eq("id", profileId);
  if (updateError) throw updateError;
}
