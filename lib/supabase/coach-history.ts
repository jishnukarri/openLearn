import "server-only";
import { db } from "./database-client";
import { getRankedLessonMisses } from "./lesson-misses";
import { COACH_MISS_LIMIT } from "@/lib/lesson-misses";
import type { TopicHistory } from "@/lib/lesson-coach-context";

// Lightweight per-topic history for the lesson coach: two bulk queries run
// in parallel (no per-row lookups), both capped. Failures degrade to no
// history rather than blocking the coach.
export async function getCoachTopicHistory(
  studentId: string,
  topicId: string,
  subjectId: string,
  topicName: string
): Promise<TopicHistory | null> {
  try {
    const [km, answers] = await Promise.all([
      db.from("knowledge_model").select("topic_name, score").eq("student_id", studentId).eq("subject_id", subjectId).lt("score", 0.5).order("score", { ascending: true }).limit(40),
      db
        .from("student_answers")
        .select("marks_awarded, max_marks, created_at, questions!inner(topic_id, prompt)")
        .eq("student_id", studentId)
        .eq("questions.topic_id", topicId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    const weakAreas = ((km.data ?? []) as { topic_name: string | null; score: number }[])
      .filter((r) => r.topic_name && (r.topic_name === topicName || r.topic_name.toLowerCase().includes(topicName.toLowerCase())))
      .slice(0, 4)
      .map((r) => `${r.topic_name} (${Math.round(r.score * 100)}%)`);
    type A = { marks_awarded: number | null; max_marks: number | null; questions: { prompt: string } | { prompt: string }[] | null };
    const recentLow = ((answers.data ?? []) as unknown as A[])
      .map((a) => ({
        prompt: (Array.isArray(a.questions) ? a.questions[0]?.prompt : a.questions?.prompt) ?? "",
        marks: a.marks_awarded ?? 0,
        max: a.max_marks ?? 0,
      }))
      .filter((a) => a.prompt && a.max > 0 && a.marks / a.max < 0.5)
      .slice(0, 4);
    const misses = await getRankedLessonMisses({ studentId, topicId, subjectId, limit: COACH_MISS_LIMIT });
    return { weakAreas, recentLow, lessonMisses: misses.map((m) => ({ prompt: m.prompt, lessonLabel: m.lessonLabel })) };
  } catch {
    return null;
  }
}
