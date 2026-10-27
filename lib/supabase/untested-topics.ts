import "server-only";
import { db } from "@/lib/supabase/database-client";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { getDiagnosticQuestions } from "@/lib/supabase/diagnostic";

export type UntestedGroup = {
  subjectId: string;
  subjectName: string;
  topics: { id: string; name: string }[];
};

// Topics in the session's subjects that the student has no knowledge_model
// row for (so the diagnostic did not cover them), in syllabus order.
export async function getUntestedTopicsForSession(
  sessionId: string,
  studentId: string
): Promise<UntestedGroup[]> {
  const questions = await getDiagnosticQuestions(sessionId);
  const subjectIds = [...new Set(questions.map((q) => q.subject_id))];
  if (subjectIds.length === 0) return [];

  const [{ data: subjects }, { data: known }, lists] = await Promise.all([
    db.from("subjects").select("id, name").in("id", subjectIds),
    db.from("knowledge_model").select("subject_id, topic_name").eq("student_id", studentId).in("subject_id", subjectIds),
    Promise.all(subjectIds.map((id) => listPublishedTopicsBySubject(id))),
  ]);
  const tested = new Set((known ?? []).map((k: { subject_id: string; topic_name: string }) => `${k.subject_id}::${k.topic_name}`));
  const names = new Map((subjects ?? []).map((s: { id: string; name: string }) => [s.id, s.name] as const));

  return subjectIds
    .map((subjectId, i) => ({
      subjectId,
      subjectName: names.get(subjectId) ?? "Subject",
      topics: lists[i]
        .filter((t) => !tested.has(`${subjectId}::${t.name}`))
        .map((t) => ({ id: t.id, name: t.name })),
    }))
    .filter((g) => g.topics.length > 0);
}
