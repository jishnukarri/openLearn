import "server-only";
import { db } from "./database-client";
import { listQuestionBankForTopic } from "./questions";
import { getTopicMastery } from "./mastery";
import { rankPractice, type LessonPractice, type PracticeCandidate } from "@/lib/lesson-personalise";

// Existing questions only, ranked from the student's own history. Any failure
// or empty history returns null and the lesson keeps its default activity.
export async function getLessonPractice(input: {
  studentId: string;
  topic: { id: string; name: string; subject_id: string };
  subtopic?: { id: string; name: string } | null;
}): Promise<LessonPractice | null> {
  try {
    const { studentId, topic, subtopic } = input;
    const bank = await listQuestionBankForTopic(topic.id);
    if (bank.length === 0) return null;
    const ids = bank.map((q) => q.id);

    const [subRes, ansRes, attRes, mastery] = await Promise.all([
      db.from("questions").select("id, subtopic_id").in("id", ids),
      db.from("student_answers").select("question_id, marks_awarded, max_marks").eq("student_id", studentId).in("question_id", ids),
      db.from("question_session_attempts").select("question_id, correct").eq("student_id", studentId).in("question_id", ids),
      getTopicMastery(studentId).catch(() => null),
    ]);
    const subOf = new Map<string, string | null>();
    if (!subRes.error) for (const r of (subRes.data ?? []) as { id: string; subtopic_id: string | null }[]) subOf.set(r.id, r.subtopic_id);
    if (ansRes.error || attRes.error) return null;

    const candidates: PracticeCandidate[] = bank.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      modelAnswer: q.model_answer,
      points: (q.markscheme ?? []).map((m) => m.point),
      maxMarks: q.max_marks,
      subtopicId: subOf.get(q.id) ?? null,
    }));

    return rankPractice({
      studentId,
      candidates,
      answers: ((ansRes.data ?? []) as { question_id: string; marks_awarded: number | null; max_marks: number | null }[]).map((r) => ({
        questionId: r.question_id,
        marksAwarded: r.marks_awarded ?? 0,
        maxMarks: r.max_marks ?? 0,
      })),
      attempts: ((attRes.data ?? []) as { question_id: string; correct: boolean }[]).map((r) => ({ questionId: r.question_id, correct: r.correct })),
      subtopicId: subtopic?.id ?? null,
      subtopicLabel: subtopic?.name ?? null,
      topicLabel: topic.name,
      mastery: mastery?.get(`${topic.subject_id}:${topic.name}`)?.score ?? null,
    });
  } catch {
    return null;
  }
}
