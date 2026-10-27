import "server-only";
import { db } from "./database-client";
import { listQuestionBankForTopic } from "./questions";
import { getTopicMastery } from "./mastery";
import { getRankedLessonMisses } from "./lesson-misses";
import { chunk, rankPractice, type LessonPractice, type PracticeCandidate } from "@/lib/lesson-personalise";

type Res = { data: unknown[] | null; error: { message?: string } | null };
function mergeRes(rs: Res[]): Res {
  const bad = rs.find((r) => r.error);
  return bad ? { data: null, error: bad.error } : { data: rs.flatMap((r) => r.data ?? []), error: null };
}

// Existing questions only, ranked from the student's own history. Any failure
// or empty history returns null and the lesson keeps its default activity.
export async function getLessonPractice(input: {
  studentId: string;
  topic: { id: string; name: string; subject_id: string };
  subtopic?: { id: string; name: string } | null;
}): Promise<LessonPractice | null> {
  const { studentId, topic, subtopic } = input;
  const lessonMisses = await getRankedLessonMisses({ studentId, topicId: topic.id, subjectId: topic.subject_id });
  try {
    const bank = await listQuestionBankForTopic(topic.id);
    const ids = bank.map((q) => q.id);

    // `.in()` with hundreds of uuids overflows the request URL, so history is
    // fetched in batches; subtopics come from one topic-scoped query.
    const batches = chunk(ids, 100);
    const [subRes, ansRes, attRes, mastery] = ids.length === 0
      ? [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, null]
      : await Promise.all([
          db.from("questions").select("id, subtopic_id").eq("topic_id", topic.id).limit(1000),
          Promise.all(batches.map((b) => db.from("student_answers").select("question_id, marks_awarded, max_marks").eq("student_id", studentId).in("question_id", b))).then(mergeRes),
          Promise.all(batches.map((b) => db.from("question_session_attempts").select("question_id, correct").eq("student_id", studentId).in("question_id", b))).then(mergeRes),
          getTopicMastery(studentId).catch(() => null),
        ]);
    const subOf = new Map<string, string | null>();
    if (!subRes.error) for (const r of (subRes.data ?? []) as { id: string; subtopic_id: string | null }[]) subOf.set(r.id, r.subtopic_id);
    if (ansRes.error || attRes.error) return lessonMisses.length ? rankPractice({ studentId, candidates: [], answers: [], attempts: [], topicLabel: topic.name, lessonMisses }) : null;

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
      lessonMisses,
    });
  } catch {
    return lessonMisses.length
      ? rankPractice({ studentId, candidates: [], answers: [], attempts: [], topicLabel: topic.name, lessonMisses })
      : null;
  }
}
