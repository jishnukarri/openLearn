import "server-only";
import { db } from "./database-client";

export type StudentSubject = {
  subject_id: string;
  subject_name: string;
  exam_board_id: string;
  exam_board_name: string;
  started_syllabus: boolean;
};

export async function getStudentSubjects(
  studentId: string
): Promise<StudentSubject[]> {
  const { data, error } = await db
    .from("student_subjects")
    .select("started_syllabus, exam_board_id, subjects(id, name), exam_boards(id, name)")
    .eq("student_id", studentId);

  if (error) throw error;

  return data.map((row: any) => ({
    subject_id: row.subjects.id,
    subject_name: row.subjects.name,
    exam_board_id: row.exam_board_id,
    exam_board_name: row.exam_boards.name,
    started_syllabus: row.started_syllabus,
  }));
}

export async function saveSubjectSelections(
  studentId: string,
  selections: { subjectId: string; examBoardId: string }[],
  startedSyllabus: boolean
): Promise<void> {
  const { error } = await db.from("student_subjects").upsert(
    selections.map((p) => ({
      student_id: studentId,
      subject_id: p.subjectId,
      exam_board_id: p.examBoardId,
      started_syllabus: startedSyllabus,
    })),
    { onConflict: "student_id,subject_id" }
  );
  if (error) throw error;
}

export type WeakTopic = { subject_name: string; topic_name: string | null; score: number };

export async function getWeakTopics(studentId: string): Promise<WeakTopic[]> {
  const { data, error } = await db
    .from("knowledge_model")
    .select("topic_name, score, subjects(name)")
    .eq("student_id", studentId)
    .eq("weak", true);

  if (error) throw error;
  return (data as any[]).map((row) => ({
    subject_name: row.subjects.name,
    topic_name: row.topic_name,
    score: row.score,
  }));
}

// Subject ids the student already has a knowledge_model entry for — i.e.
// has completed at least one diagnostic covering that subject. A pure DB
// read (no AI) so callers can cheaply decide whether a diagnostic is
// actually needed before ever generating one.
export async function getDiagnosedSubjectIds(studentId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("knowledge_model")
    .select("subject_id")
    .eq("student_id", studentId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.subject_id as string));
}

// Subjects the student has picked but never sat a diagnostic for — newly
// added subjects land here until they complete one.
export async function getSubjectsNeedingDiagnostic(
  studentId: string
): Promise<StudentSubject[]> {
  const [subjects, diagnosed] = await Promise.all([
    getStudentSubjects(studentId),
    getDiagnosedSubjectIds(studentId),
  ]);
  return subjects.filter((s) => !diagnosed.has(s.subject_id));
}

// Returns the student's diagnostic score (0–1) for a topic by name + subject,
// or null if no diagnostic has been run for this topic.
export async function getTopicDiagnosticScore(
  studentId: string,
  topicName: string,
  subjectId: string
): Promise<number | null> {
  const { data, error } = await db
    .from("knowledge_model")
    .select("score")
    .eq("student_id", studentId)
    .eq("subject_id", subjectId)
    .eq("topic_name", topicName)
    .maybeSingle();
  if (error) throw error;
  return data?.score ?? null;
}

// Returns the first published topic name per subject id (position order).
// Used to scope the quick diagnostic to just one topic per subject.
export async function getFirstTopicPerSubject(
  subjectIds: string[]
): Promise<Map<string, string>> {
  if (subjectIds.length === 0) return new Map();
  const { data, error } = await db
    .from("topics")
    .select("subject_id, name")
    .in("subject_id", subjectIds)
    .eq("status", "published")
    .order("position");
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data as { subject_id: string; name: string }[]) {
    if (!map.has(row.subject_id)) map.set(row.subject_id, row.name);
  }
  return map;
}

export async function hasOnboarded(studentId: string): Promise<boolean> {
  const { count, error } = await db
    .from("student_subjects")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (error) throw error;
  return (count ?? 0) > 0;
}
