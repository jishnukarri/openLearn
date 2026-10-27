import "server-only";
import { db } from "./database-client";
import { listAuditForTarget } from "./admin-audit";
import { safeCursor } from "@/lib/ids";
import {
  normaliseFeedback,
  PAGE_SIZE,
  matchesFilter,
  mergeEvents,
  paginate,
  truncateSnippet,
  type ActivityEvent,
  type ActivityFilter,
  type ActivityKind,
} from "@/lib/student-activity";

type Rows<T> = T[];
const rows = <T>(r: { data: unknown; error: { message: string } | null }): Rows<T> => {
  if (r.error) throw r.error;
  return (r.data ?? []) as Rows<T>;
};
// Supabase may return a joined relation as an object or a one-item array.
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type TopicJoin = { name: string; subjects: { name: string } | { name: string }[] | null };
const topicLabel = (t: TopicJoin | TopicJoin[] | null | undefined) => {
  const topic = one(t);
  return { topic: topic?.name ?? "a topic", subject: one(topic?.subjects)?.name ?? null };
};

export type StudentActivityPage = { events: ActivityEvent[]; nextBefore: string | null };

export async function getStudentActivity(
  studentId: string,
  opts: { limit?: number; before?: string | null; filter?: ActivityFilter; includeAdmin?: boolean } = {},
): Promise<StudentActivityPage> {
  const limit = opts.limit ?? PAGE_SIZE;
  const before = safeCursor(opts.before);
  const filter = opts.filter ?? "all";
  const n = limit + 1; // one extra row tells us whether another page exists
  const want = (...kinds: ActivityKind[]) => kinds.some((k) => matchesFilter(k, filter));
  const lt = <Q>(q: Q, col: string): Q =>
    before ? ((q as unknown as { lt: (c: string, v: string) => Q }).lt(col, before)) : q;

  const jobs: Promise<ActivityEvent[]>[] = [];
  const add = (p: () => Promise<ActivityEvent[]>) => jobs.push(p());

  if (want("account")) {
    add(async () => {
      const r = await db.from("profiles").select("id, created_at").eq("id", studentId).maybeSingle();
      const c = (r.data as { created_at: string } | null)?.created_at;
      return c && (!before || c < before) ? [{ id: "account", kind: "account", at: c, text: "Account created" }] : [];
    });
  }

  if (want("subjects")) {
    add(async () => {
      const q = db.from("student_subjects").select("subject_id, created_at, subjects(name)").eq("student_id", studentId);
      const r = rows<{ subject_id: string; created_at: string; subjects: { name: string } | { name: string }[] | null }>(
        await lt(q, "created_at").order("created_at", { ascending: false }).limit(n),
      );
      return r.map((x) => ({ id: `subject:${x.subject_id}`, kind: "subjects" as const, at: x.created_at, text: `Chose ${one(x.subjects)?.name ?? "a subject"} to study` }));
    });
  }

  if (want("diagnostic-started", "diagnostic-completed")) {
    add(async () => {
      const q = db.from("diagnostic_sessions").select("id, mode, created_at").eq("student_id", studentId);
      const sessions = rows<{ id: string; mode: string; created_at: string }>(
        await lt(q, "created_at").order("created_at", { ascending: false }).limit(n),
      );
      if (sessions.length === 0) return [];
      const ids = sessions.map((s) => s.id);
      const qs = rows<{ id: string; session_id: string; max_marks: number | null }>(
        await db.from("diagnostic_questions").select("id, session_id, max_marks").in("session_id", ids),
      );
      const ans = qs.length
        ? rows<{ question_id: string; score: number | null; created_at: string }>(
            await db.from("diagnostic_answers").select("question_id, score, created_at").in("question_id", qs.map((x) => x.id)),
          )
        : [];
      const answerByQ = new Map(ans.map((a) => [a.question_id, a]));
      const out: ActivityEvent[] = [];
      for (const s of sessions) {
        const sq = qs.filter((x) => x.session_id === s.id);
        out.push({ id: `diag:${s.id}`, kind: "diagnostic-started", at: s.created_at, text: `Started a ${s.mode === "recap" ? "recap " : ""}diagnostic test`, detail: `${sq.length} questions` });
        const answered = sq.map((x) => ({ q: x, a: answerByQ.get(x.id) })).filter((x) => x.a);
        if (sq.length > 0 && answered.length === sq.length) {
          const got = answered.reduce((t, x) => t + Math.max(0, Number(x.a!.score ?? 0)), 0);
          const max = sq.reduce((t, x) => t + (x.max_marks ?? 0), 0);
          const at = answered.map((x) => x.a!.created_at).sort().at(-1)!;
          if (!before || at < before)
            out.push({ id: `diag-done:${s.id}`, kind: "diagnostic-completed", at, text: "Finished a diagnostic test", detail: max > 0 ? `Scored ${Math.round(got * 10) / 10}/${max} marks` : undefined });
        }
      }
      return out.filter((e) => matchesFilter(e.kind, filter));
    });
  }

  if (want("lesson")) {
    add(async () => {
      const tq = db.from("topic_completions").select("topic_id, completed_at, topics(name, subjects(name))").eq("student_id", studentId);
      const sq = db.from("subtopic_completions").select("subtopic_id, completed_at, subtopics(name)").eq("student_id", studentId);
      const [t, s] = await Promise.all([
        lt(tq, "completed_at").order("completed_at", { ascending: false }).limit(n),
        lt(sq, "completed_at").order("completed_at", { ascending: false }).limit(n),
      ]);
      const topics = rows<{ topic_id: string; completed_at: string; topics: TopicJoin | TopicJoin[] | null }>(t).map((x) => {
        const l = topicLabel(x.topics);
        return { id: `topic:${x.topic_id}`, kind: "lesson" as const, at: x.completed_at, text: `Completed the topic ${l.topic}`, detail: l.subject ?? undefined };
      });
      const subs = rows<{ subtopic_id: string; completed_at: string; subtopics: { name: string } | { name: string }[] | null }>(s).map((x) => ({
        id: `subtopic:${x.subtopic_id}`, kind: "lesson" as const, at: x.completed_at, text: `Completed the lesson ${one(x.subtopics)?.name ?? "lesson"}`,
      }));
      return [...topics, ...subs];
    });
  }

  if (want("practice-started", "practice-completed")) {
    add(async () => {
      const sel: string = "id, started_at, completed_at, mastery_exit, topics(name, subjects(name))";
      type S = { id: string; started_at: string; completed_at: string | null; mastery_exit: boolean | null; topics: TopicJoin | TopicJoin[] | null };
      const a = db.from("question_sessions").select(sel).eq("student_id", studentId);
      const b = db.from("question_sessions").select(sel).eq("student_id", studentId).not("completed_at", "is", null);
      const [started, done] = await Promise.all([
        lt(a, "started_at").order("started_at", { ascending: false }).limit(n),
        lt(b, "completed_at").order("completed_at", { ascending: false }).limit(n),
      ]);
      const out: ActivityEvent[] = [];
      for (const x of rows<S>(started)) {
        const l = topicLabel(x.topics);
        out.push({ id: `qs:${x.id}`, kind: "practice-started", at: x.started_at, text: `Started practising ${l.topic}`, detail: l.subject ?? undefined });
      }
      for (const x of rows<S>(done)) {
        const l = topicLabel(x.topics);
        out.push({
          id: `qs-done:${x.id}`, kind: "practice-completed", at: x.completed_at!,
          text: x.mastery_exit ? `Mastered ${l.topic} and finished practice early` : `Finished a practice session on ${l.topic}`,
          detail: l.subject ?? undefined,
        });
      }
      return out.filter((e) => matchesFilter(e.kind, filter));
    });
  }

  if (want("answer")) {
    add(async () => {
      const q = db
        .from("student_answers")
        .select("id, created_at, marks_awarded, max_marks, answer_text, feedback, questions(prompt, topics(name, subjects(name)))")
        .eq("student_id", studentId);
      type A = {
        id: string; created_at: string; marks_awarded: number | null; max_marks: number | null; answer_text: string | null; feedback: unknown;
        questions: { prompt: string | null; topics: TopicJoin | TopicJoin[] | null } | { prompt: string | null; topics: TopicJoin | TopicJoin[] | null }[] | null;
      };
      return rows<A>(await lt(q, "created_at").order("created_at", { ascending: false }).limit(n)).map((x) => {
        const question = one(x.questions);
        const l = topicLabel(question?.topics);
        const marks = x.max_marks != null ? `${x.marks_awarded ?? 0}/${x.max_marks} ${x.max_marks === 1 ? "mark" : "marks"}` : "not marked yet";
        const snippet = truncateSnippet(question?.prompt);
        return {
          id: `ans:${x.id}`, kind: "answer" as const, at: x.created_at,
          text: `Answered ${l.subject ? `a ${l.subject}` : "a"} question: ${marks}`,
          detail: snippet || undefined,
          answer: { question: question?.prompt ?? null, written: x.answer_text, feedback: normaliseFeedback(x.feedback) },
        };
      });
    });
  }

  if (want("class")) {
    add(async () => {
      const q = db.from("class_members").select("class_id, joined_at, classes(name)").eq("student_id", studentId);
      return rows<{ class_id: string; joined_at: string; classes: { name: string } | { name: string }[] | null }>(
        await lt(q, "joined_at").order("joined_at", { ascending: false }).limit(n),
      ).map((x) => ({ id: `class:${x.class_id}`, kind: "class" as const, at: x.joined_at, text: `Joined the class ${one(x.classes)?.name ?? "a class"}` }));
    });
  }

  if (want("paper")) {
    add(async () => {
      const roster = rows<{ id: string }>(await db.from("paper_roster_entries").select("id").eq("student_id", studentId));
      if (roster.length === 0) return [];
      const q = db
        .from("paper_submissions")
        .select("id, created_at, total_marks_awarded, total_possible_marks, papers(title)")
        .in("roster_entry_id", roster.map((r) => r.id));
      return rows<{ id: string; created_at: string; total_marks_awarded: number | null; total_possible_marks: number | null; papers: { title: string } | { title: string }[] | null }>(
        await lt(q, "created_at").order("created_at", { ascending: false }).limit(n),
      ).map((x) => ({
        id: `paper:${x.id}`, kind: "paper" as const, at: x.created_at,
        text: `Paper submitted: ${one(x.papers)?.title ?? "a paper"}`,
        detail: x.total_possible_marks ? `Scored ${x.total_marks_awarded ?? 0}/${x.total_possible_marks} marks` : undefined,
      }));
    });
  }

  if (opts.includeAdmin && filter === "all") {
    add(async () => {
      const list = await listAuditForTarget(studentId, n, before ?? undefined);
      return list.map((x) => ({
        id: `audit:${x.id}`, kind: "admin" as const, at: x.created_at,
        text: `An admin took a support action: ${x.action.replace(/[-_]/g, " ")}`,
        detail: x.reason ? truncateSnippet(x.reason) : undefined,
      }));
    });
  }

  const merged = mergeEvents(...(await Promise.all(jobs)));
  return paginate(merged, limit);
}
