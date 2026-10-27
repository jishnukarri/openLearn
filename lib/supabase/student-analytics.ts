import "server-only";
import { db } from "./database-client";
import { getProfileById } from "./profiles";
import { getTopicMastery, loadMasteryCatalog } from "./mastery";
import { getCompletedPieces } from "./onboarding-progress";
import { isUuid } from "@/lib/ids";
import { ONBOARDING_PIECES } from "@/lib/onboarding-pieces";
import { getCompletedSubtopicIds, getCompletedTopicIds } from "./progress";
import {
  ACTIVITY_WINDOW_DAYS,
  attentionReasons,
  averageScore,
  bucketActivity,
  latestTimestamp,
  type AttentionReason,
  type DayPoint,
} from "@/lib/student-analytics";

export type TopicMastery = { subjectId: string; subjectName: string; topicName: string; score: number; diagnostic: number };

export type StudentOverview = {
  profile: NonNullable<Awaited<ReturnType<typeof getProfileById>>>;
  lastActive: string | null;
  mastery: TopicMastery[];
  avgScore: number | null;
  attention: AttentionReason[];
  activity: DayPoint[];
  totalAnswers: number;
  accuracyPercent: number | null;
  lessonsCompleted: number;
  diagnostics: { id: string; mode: string; status: string | null; createdAt: string }[];
  classes: { id: string; name: string }[];
  /** Unresolved lesson check misses; empty if the table is unavailable. */
  trickyIdeas: { id: string; prompt: string; topicName: string; missedCount: number }[];
  /** Intro pieces; null when the table is unavailable or the user is not a student. */
  onboarding: { title: string; done: boolean }[] | null;
};

async function loadTrickyIdeas(studentId: string): Promise<StudentOverview["trickyIdeas"]> {
  try {
    const { data, error } = await db
      .from("lesson_check_misses")
      .select("id, prompt, missed_count, topics(name)")
      .eq("student_id", studentId)
      .eq("resolved", false)
      .order("last_missed_at", { ascending: false })
      .limit(8);
    if (error) return [];
    return ((data ?? []) as unknown as { id: string; prompt: string; missed_count: number; topics: { name: string } | null }[]).map((r) => ({
      id: r.id, prompt: r.prompt, topicName: r.topics?.name ?? "A lesson", missedCount: r.missed_count,
    }));
  } catch {
    return [];
  }
}

async function latestActivity(studentId: string): Promise<string | null> {
  const [a, b, c] = await Promise.all([
    db.from("student_answers").select("created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1),
    db.from("question_session_attempts").select("attempted_at").eq("student_id", studentId).order("attempted_at", { ascending: false }).limit(1),
    db.from("question_sessions").select("started_at").eq("student_id", studentId).order("started_at", { ascending: false }).limit(1),
  ]);
  return latestTimestamp([
    (a.data as { created_at: string }[] | null)?.[0]?.created_at,
    (b.data as { attempted_at: string }[] | null)?.[0]?.attempted_at,
    (c.data as { started_at: string }[] | null)?.[0]?.started_at,
  ]);
}

// Past PostgREST's 1000-row response cap: page through (bounded) so totals
// and accuracy don't silently cover only part of a busy student's history.
async function allMarks(studentId: string) {
  const out: { marks_awarded: number | null; max_marks: number | null }[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const r = await db
      .from("student_answers")
      .select("marks_awarded, max_marks")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (r.error) return { data: null, error: r.error };
    out.push(...((r.data ?? []) as typeof out));
    if ((r.data ?? []).length < 1000) break;
  }
  return { data: out, error: null };
}

export async function getStudentOverview(studentId: string): Promise<StudentOverview | null> {
  const profile = await getProfileById(studentId);
  if (!profile) return null;

  const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000).toISOString();
  const [masteryMap, lastActivity, kmRes, topics, subtopics, recent, allAnswers, diag, cls] = await Promise.all([
    getTopicMastery(studentId),
    latestActivity(studentId),
    db.from("knowledge_model").select("subject_id, topic_name, score, subjects(name)").eq("student_id", studentId),
    getCompletedTopicIds(studentId),
    getCompletedSubtopicIds(studentId),
    db.from("student_answers").select("created_at, marks_awarded, max_marks").eq("student_id", studentId).gte("created_at", since),
    allMarks(studentId),
    db.from("diagnostic_sessions").select("id, mode, status, created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(10),
    db.from("class_members").select("classes(id, name)").eq("student_id", studentId),
  ]);
  const [trickyIdeas, pieces] = await Promise.all([
    loadTrickyIdeas(studentId),
    profile.role === "student" ? getCompletedPieces(studentId) : Promise.resolve(null),
  ]);
  for (const r of [kmRes, recent, allAnswers, diag, cls]) if (r.error) throw r.error;

  type Km = { subject_id: string; topic_name: string | null; score: number; subjects: { name: string } | null };
  const mastery = ((kmRes.data ?? []) as unknown as Km[])
    .filter((r) => r.topic_name)
    .map((r) => ({ subjectId: r.subject_id, subjectName: r.subjects?.name ?? "Subject", topicName: r.topic_name as string, score: masteryMap.get(`${r.subject_id}:${r.topic_name}`)?.score ?? r.score, diagnostic: r.score }));

  const answers = (allAnswers.data ?? []) as { marks_awarded: number | null; max_marks: number | null }[];
  const got = answers.reduce((s, a) => s + (a.marks_awarded ?? 0), 0);
  const max = answers.reduce((s, a) => s + (a.max_marks ?? 0), 0);

  const lastActive = latestTimestamp([lastActivity, profile.last_active_date]);
  const avg = averageScore(mastery.map((m) => m.score));

  return {
    profile,
    lastActive,
    mastery,
    avgScore: avg,
    attention: attentionReasons({ lastActive, avgScore: avg }),
    activity: bucketActivity((recent.data ?? []) as { created_at: string; marks_awarded: number | null; max_marks: number | null }[]),
    totalAnswers: answers.length,
    accuracyPercent: max > 0 ? Math.round((got / max) * 100) : null,
    lessonsCompleted: topics.size + subtopics.size,
    diagnostics: ((diag.data ?? []) as { id: string; mode: string; status: string | null; created_at: string }[]).map((d) => ({
      id: d.id, mode: d.mode, status: d.status, createdAt: d.created_at,
    })),
    trickyIdeas,
    onboarding: pieces && pieces.available ? ONBOARDING_PIECES.map((p) => ({ title: p.title, done: pieces.completed.has(p.key) })) : null,
    classes: ((cls.data ?? []) as unknown as { classes: { id: string; name: string } | null }[]).flatMap((r) => (r.classes ? [r.classes] : [])),
  };
}

// A teacher may only see students who sit in one of their own classes.
export async function teacherCanViewStudent(teacherId: string, studentId: string): Promise<boolean> {
  if (!isUuid(studentId) || !isUuid(teacherId)) return false;
  const { data, error } = await db
    .from("class_members")
    .select("class_id, classes!inner(teacher_id)")
    .eq("student_id", studentId)
    .eq("classes.teacher_id", teacherId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

const MAX_CLASS_ROSTER = 300;
const MASTERY_CONCURRENCY = 8;

export type ClassRow = {
  profileId: string;
  fullName: string | null;
  email: string;
  xp: number;
  streak: number;
  lastActive: string | null;
  avgScore: number | null;
  attention: AttentionReason[];
};

export async function getClassOverview(classId: string, teacherId: string): Promise<{ name: string; rows: ClassRow[] } | null> {
  if (!isUuid(classId)) return null;
  const { data: cls } = await db.from("classes").select("id, name").eq("id", classId).eq("teacher_id", teacherId).maybeSingle();
  if (!cls) return null;
  const { data: members, error } = await db
    .from("class_members")
    .select("profiles(id, full_name, email, xp, streak_count, last_active_date)")
    .eq("class_id", classId)
    .limit(MAX_CLASS_ROSTER);
  if (error) throw error;
  type P = { id: string; full_name: string | null; email: string; xp: number; streak_count: number; last_active_date: string | null };
  const profiles = ((members ?? []) as unknown as { profiles: P | null }[]).flatMap((m) => (m.profiles ? [m.profiles] : []));
  const ids = profiles.map((p) => p.id);
  if (ids.length === 0) return { name: cls.name, rows: [] };

  // One shared topic catalog, and bounded concurrency, so a large class
  // doesn't fire hundreds of simultaneous query bursts.
  const catalog = await loadMasteryCatalog();
  const scores = new Map<string, number[]>();
  for (let i = 0; i < ids.length; i += MASTERY_CONCURRENCY) {
    const chunk = ids.slice(i, i + MASTERY_CONCURRENCY);
    const maps = await Promise.all(chunk.map((id) => getTopicMastery(id, catalog)));
    chunk.forEach((id, j) => scores.set(id, [...maps[j].values()].map((m) => m.score)));
  }

  // Latest answer per student. The combined newest-first scan is capped, so
  // anyone it doesn't reach is looked up individually instead of being
  // wrongly shown as inactive.
  const ans = await db.from("student_answers").select("student_id, created_at").in("student_id", ids).order("created_at", { ascending: false }).limit(5000);
  if (ans.error) throw ans.error;
  const lastAns = new Map<string, string>();
  for (const r of (ans.data ?? []) as { student_id: string; created_at: string }[]) {
    if (!lastAns.has(r.student_id)) lastAns.set(r.student_id, r.created_at);
  }
  const missing = ids.filter((id) => !lastAns.has(id));
  if ((ans.data ?? []).length >= 5000) {
    for (let i = 0; i < missing.length; i += MASTERY_CONCURRENCY) {
      await Promise.all(
        missing.slice(i, i + MASTERY_CONCURRENCY).map(async (id) => {
          const r = await db.from("student_answers").select("created_at").eq("student_id", id).order("created_at", { ascending: false }).limit(1);
          const at = (r.data as { created_at: string }[] | null)?.[0]?.created_at;
          if (at) lastAns.set(id, at);
        })
      );
    }
  }

  const rows = profiles.map((p) => {
    const lastActive = latestTimestamp([lastAns.get(p.id), p.last_active_date]);
    const avg = averageScore(scores.get(p.id) ?? []);
    return {
      profileId: p.id, fullName: p.full_name, email: p.email, xp: p.xp, streak: p.streak_count,
      lastActive, avgScore: avg, attention: attentionReasons({ lastActive, avgScore: avg }),
    };
  });
  return { name: cls.name, rows };
}
