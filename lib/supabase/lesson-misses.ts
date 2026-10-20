import "server-only";
import { db } from "./database-client";
import { listTopicsBySubject } from "./topics";
import {
  missPrompt,
  previousTopicIds,
  rankLessonMisses,
  type LessonMiss,
} from "@/lib/lesson-misses";

// Every call degrades to "no misses" if the table or query fails, so lessons
// behave exactly as before until the migration is applied. Warns once.
let warned = false;
function tolerate(error: { message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (!warned) {
    warned = true;
    console.warn(`[lesson_check_misses] unavailable, carrying on without it: ${error.message ?? "unknown error"}`);
  }
  return true;
}

type Row = {
  id: string;
  topic_id: string;
  subtopic_id: string | null;
  prompt: string;
  correct_answer: string | null;
  missed_count: number;
  last_missed_at: string;
  resolved: boolean;
};

// First-try wrong: create the row or bump its count and reopen it.
export async function recordLessonMiss(input: {
  studentId: string;
  topicId: string;
  subtopicId: string | null;
  prompt: string;
  correctAnswer: string;
}): Promise<void> {
  try {
    const prompt = missPrompt(input.prompt);
    if (!prompt) return;
    const { data, error } = await db
      .from("lesson_check_misses")
      .select("id, missed_count")
      .eq("student_id", input.studentId)
      .eq("topic_id", input.topicId)
      .eq("prompt", prompt)
      .maybeSingle();
    if (tolerate(error)) return;
    const now = new Date().toISOString();
    if (data) {
      const r = await db
        .from("lesson_check_misses")
        .update({ missed_count: (data.missed_count as number) + 1, last_missed_at: now, resolved: false, correct_answer: input.correctAnswer.slice(0, 500) })
        .eq("id", data.id);
      tolerate(r.error);
    } else {
      const r = await db.from("lesson_check_misses").insert({
        student_id: input.studentId,
        topic_id: input.topicId,
        subtopic_id: input.subtopicId,
        prompt,
        correct_answer: input.correctAnswer.slice(0, 500),
      });
      tolerate(r.error);
    }
  } catch (e) {
    tolerate({ message: e instanceof Error ? e.message : String(e) });
  }
}

// Same prompt answered right first time later: close the miss.
export async function resolveLessonMiss(studentId: string, topicId: string, prompt: string): Promise<void> {
  try {
    const r = await db
      .from("lesson_check_misses")
      .update({ resolved: true })
      .eq("student_id", studentId)
      .eq("topic_id", topicId)
      .eq("prompt", missPrompt(prompt))
      .eq("resolved", false);
    tolerate(r.error);
  } catch (e) {
    tolerate({ message: e instanceof Error ? e.message : String(e) });
  }
}

export async function resolveLessonMissById(studentId: string, missId: string): Promise<void> {
  try {
    const r = await db.from("lesson_check_misses").update({ resolved: true }).eq("student_id", studentId).eq("id", missId);
    tolerate(r.error);
  } catch (e) {
    tolerate({ message: e instanceof Error ? e.message : String(e) });
  }
}

// Unresolved misses for this lesson and the one or two before it in the subject.
export async function getRankedLessonMisses(input: {
  studentId: string;
  topicId: string;
  subjectId: string;
  limit?: number;
}): Promise<LessonMiss[]> {
  try {
    const topics = await listTopicsBySubject(input.subjectId);
    const self = topics.find((t) => t.id === input.topicId);
    const prev = self ? previousTopicIds(topics, self.position) : [];
    const ids = [input.topicId, ...prev];
    const { data, error } = await db
      .from("lesson_check_misses")
      .select("id, topic_id, subtopic_id, prompt, correct_answer, missed_count, last_missed_at, resolved")
      .eq("student_id", input.studentId)
      .eq("resolved", false)
      .in("topic_id", ids)
      .limit(60);
    if (tolerate(error)) return [];
    const nameOf = new Map(topics.map((t) => [t.id, t.name]));
    const misses: LessonMiss[] = ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      subtopicId: r.subtopic_id,
      prompt: r.prompt,
      correctAnswer: r.correct_answer ?? "",
      missedCount: r.missed_count,
      lastMissedAt: r.last_missed_at,
      resolved: r.resolved,
      lessonLabel: nameOf.get(r.topic_id) ?? "an earlier lesson",
    }));
    return rankLessonMisses(misses, { topicId: input.topicId, previousTopicIds: prev, limit: input.limit });
  } catch (e) {
    tolerate({ message: e instanceof Error ? e.message : String(e) });
    return [];
  }
}
