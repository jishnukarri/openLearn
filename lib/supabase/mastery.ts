import "server-only";
import { db } from "./database-client";
import { computeMastery, weightPractice, type MasteryResult } from "@/lib/mastery";

type Topic = { id: string; name: string; subject_id: string };

// Blended mastery per topic, keyed `${subjectId}:${topicName}` (same key as
// getTopicScores). Five bulk queries, no per-topic lookups. No recall data
// source exists yet, so recallDone is left unused.
export type MasteryCatalog = { topics: Topic[]; subs: { id: string; topic_id: string }[] };

// The topic/subtopic tables are the same for every student, so callers that
// score many students (a class roster) load them once and pass them in.
export async function loadMasteryCatalog(): Promise<MasteryCatalog> {
  const [topicsRes, subsRes] = await Promise.all([
    db.from("topics").select("id, name, subject_id"),
    db.from("subtopics").select("id, topic_id"),
  ]);
  if (topicsRes.error) throw topicsRes.error;
  if (subsRes.error) throw subsRes.error;
  return { topics: (topicsRes.data ?? []) as Topic[], subs: (subsRes.data ?? []) as { id: string; topic_id: string }[] };
}

// PostgREST caps a response at 1000 rows by default, which would silently
// drop a busy student's older answers. Page through, bounded.
async function allAnswers(studentId: string) {
  const out: unknown[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const r = await db
      .from("student_answers")
      .select("marks_awarded, max_marks, created_at, questions(topic_id, subtopic_id)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (r.error) return { data: null, error: r.error };
    out.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) break;
  }
  return { data: out, error: null };
}

export async function getTopicMastery(studentId: string, catalog?: MasteryCatalog): Promise<Map<string, MasteryResult>> {
  const [km, answers, tc, sc] = await Promise.all([
    db.from("knowledge_model").select("subject_id, topic_name, score").eq("student_id", studentId),
    allAnswers(studentId),
    db.from("topic_completions").select("topic_id").eq("student_id", studentId),
    db.from("subtopic_completions").select("subtopic_id").eq("student_id", studentId),
  ]);
  for (const r of [km, answers, tc, sc]) if (r.error) throw r.error;

  const { topics, subs: subRows } = catalog ?? (await loadMasteryCatalog());
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const subToTopic = new Map(subRows.map((s) => [s.id, s.topic_id]));
  const keyOf = (t: Topic) => `${t.subject_id}:${t.name}`;

  const diagnostic = new Map<string, number>();
  for (const r of (km.data ?? []) as { subject_id: string; topic_name: string | null; score: number }[]) {
    if (r.topic_name) diagnostic.set(`${r.subject_id}:${r.topic_name}`, r.score);
  }

  const now = Date.now();
  const byKey = new Map<string, { marksAwarded: number; marksPossible: number; ageDays: number }[]>();
  type A = { marks_awarded: number | null; max_marks: number | null; created_at: string; questions: { topic_id: string | null; subtopic_id: string | null } | null };
  for (const a of (answers.data ?? []) as unknown as A[]) {
    const tid = a.questions?.topic_id ?? (a.questions?.subtopic_id ? subToTopic.get(a.questions.subtopic_id) : undefined);
    const topic = tid ? topicById.get(tid) : undefined;
    if (!topic || !a.max_marks) continue;
    const list = byKey.get(keyOf(topic)) ?? [];
    list.push({ marksAwarded: a.marks_awarded ?? 0, marksPossible: a.max_marks, ageDays: (now - new Date(a.created_at).getTime()) / 86_400_000 });
    byKey.set(keyOf(topic), list);
  }

  const doneTopics = new Set(((tc.data ?? []) as { topic_id: string }[]).map((r) => r.topic_id));
  const doneSubs = new Set(((sc.data ?? []) as { subtopic_id: string }[]).map((r) => r.subtopic_id));
  const subsOf = new Map<string, string[]>();
  for (const [sid, tid] of subToTopic) subsOf.set(tid, [...(subsOf.get(tid) ?? []), sid]);

  const out = new Map<string, MasteryResult>();
  for (const t of topics) {
    const key = keyOf(t);
    const subs = subsOf.get(t.id) ?? [];
    const lessonComplete = doneTopics.has(t.id) || (subs.length > 0 && subs.every((s) => doneSubs.has(s)));
    const practice = weightPractice(byKey.get(key) ?? []);
    const d = diagnostic.get(key) ?? null;
    if (d === null && !practice && !lessonComplete) continue;
    out.set(key, computeMastery({ diagnostic: d, practice, lessonComplete }));
  }
  for (const [key, d] of diagnostic) {
    if (!out.has(key)) out.set(key, computeMastery({ diagnostic: d, practice: null, lessonComplete: false }));
  }
  return out;
}
