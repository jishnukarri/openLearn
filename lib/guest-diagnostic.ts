import "server-only";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { getTopicDiagnosticPools } from "@/lib/supabase/topic-diagnostic-questions";
import {
  createDiagnosticSessionFromPool,
  convertGuestSession,
  buildKnowledgeModel,
  getDiagnosticQuestions,
  type DiagnosticQuestion,
} from "@/lib/supabase/diagnostic";
import { saveSubjectSelections } from "@/lib/supabase/students";
import { DIAGNOSTIC_MAX_QUESTIONS, selectTopicsForDiagnostic } from "@/lib/diagnostic-select";

// Per-topic sample size for the guest teaser — small enough to keep the
// whole quiz inside a "5 minute" budget across several topics, but still
// touching every topic at least once. Zero AI cost: this only reads
// already-generated pool rows (see lib/ai/diagnostic-pool.ts).
const QUESTIONS_PER_TOPIC_SAMPLE = 2;
const RECAP_QUESTIONS_PER_TOPIC = 4;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type PoolQuestion = {
  subjectId: string;
  topicName: string | null;
  type: "mcq" | "fill_blank" | "match" | "short_answer";
  prompt: string;
  maxMarks: number;
  content: DiagnosticQuestion["content"];
};

// Samples preset questions from each topic's pre-generated pool. Topics with
// no pool yet (pool generation is best-effort and can fail/lag) are
// silently skipped — better a shorter quiz than a broken one.
async function samplePoolQuestions(
  topics: { id: string; name: string; subject_id: string }[],
  perTopic: number
): Promise<PoolQuestion[]> {
  if (topics.length === 0) return [];
  const pools = await getTopicDiagnosticPools(topics.map((t) => t.id));
  const questions: PoolQuestion[] = [];
  for (const topic of topics) {
    const pool = pools.get(topic.id);
    if (!pool || pool.length === 0) continue;
    for (const q of shuffle(pool).slice(0, perTopic)) {
      questions.push({
        subjectId: topic.subject_id,
        topicName: topic.name,
        type: q.type,
        prompt: q.prompt,
        maxMarks: q.maxMarks,
        content: q.content as DiagnosticQuestion["content"],
      });
    }
  }
  return questions;
}

// Builds a guest diagnostic session by sampling from each selected
// subject's topics' pre-generated question pools.
export async function buildGuestDiagnostic(
  guestToken: string,
  subjectIds: string[]
): Promise<{ sessionId: string; questionCount: number } | null> {
  const topicsBySubject = await Promise.all(
    subjectIds.map((id) => listPublishedTopicsBySubject(id))
  );
  const { selected } = selectTopicsForDiagnostic(topicsBySubject, QUESTIONS_PER_TOPIC_SAMPLE);
  const questions = (await samplePoolQuestions(selected, QUESTIONS_PER_TOPIC_SAMPLE)).slice(
    0,
    DIAGNOSTIC_MAX_QUESTIONS
  );
  if (questions.length === 0) return null;

  const sessionId = await createDiagnosticSessionFromPool({ guestToken, questions });
  return { sessionId, questionCount: questions.length };
}

// Signed-in diagnostic from the same preset question pools, so it costs no
// AI credits. "quick" uses the first topic of each subject with a few
// questions; "full" covers every topic. Returns null when the pools have
// nothing, so the caller can fall back to AI generation.
export async function buildStudentPoolDiagnostic(input: {
  studentId: string;
  subjects: { subjectId: string; examBoardId?: string | null }[];
  scope: "quick" | "full";
}): Promise<string | null> {
  const topicsBySubject = await Promise.all(
    input.subjects.map((s) => listPublishedTopicsBySubject(s.subjectId, s.examBoardId ?? undefined))
  );
  const perTopic = input.scope === "quick" ? 4 : QUESTIONS_PER_TOPIC_SAMPLE;
  const topics =
    input.scope === "quick"
      ? selectTopicsForDiagnostic(topicsBySubject.map((list) => list.slice(0, 1)), perTopic).selected
      : selectTopicsForDiagnostic(topicsBySubject, perTopic).selected;
  const questions = (await samplePoolQuestions(topics, perTopic)).slice(0, DIAGNOSTIC_MAX_QUESTIONS);
  if (questions.length === 0) return null;
  return createDiagnosticSessionFromPool({
    studentId: input.studentId,
    mode: "fresh",
    questions,
  });
}

// Recap diagnostic (topics the student says they've already covered) from
// the same pools. Null when none of those topics has a pool yet.
export async function buildStudentRecapPoolDiagnostic(input: {
  studentId: string;
  selections: { subjectId: string; topicName: string }[];
}): Promise<string | null> {
  const subjectIds = [...new Set(input.selections.map((s) => s.subjectId))];
  const bySubject = await Promise.all(subjectIds.map((id) => listPublishedTopicsBySubject(id)));
  const wanted = new Set(input.selections.map((s) => `${s.subjectId}::${s.topicName}`));
  const topics = bySubject.flat().filter((t) => wanted.has(`${t.subject_id}::${t.name}`));
  const perTopic = RECAP_QUESTIONS_PER_TOPIC;
  const { selected } = selectTopicsForDiagnostic([topics], perTopic);
  const questions = (await samplePoolQuestions(selected, perTopic)).slice(0, DIAGNOSTIC_MAX_QUESTIONS);
  if (questions.length === 0) return null;
  return createDiagnosticSessionFromPool({
    studentId: input.studentId,
    mode: "recap",
    questions,
  });
}

// Attaches a completed guest diagnostic session to a real student account:
// converts ownership, builds the knowledge model, and enrolls them in
// whatever subjects the guest session actually covered (the guest picker
// never asked for an exam board, so each subject uses its first configured
// one — matching how /start's subject picker itself has no board field).
// Used both right after signup (app/actions/auth.ts) and when a visitor
// turns out to already be logged in while viewing the guest results teaser
// (app/start/results/[sessionId]/page.tsx) — either path should end with
// the same "this is now a real result, not a locked teaser" outcome.
export async function convertGuestSessionToStudent(
  sessionId: string,
  studentId: string
): Promise<void> {
  await convertGuestSession(sessionId, studentId);
  await buildKnowledgeModel(sessionId, studentId);

  const [questions, subjects] = await Promise.all([
    getDiagnosticQuestions(sessionId),
    listPublishedSubjects(),
  ]);

  const subjectIds = [...new Set(questions.map((q) => q.subject_id))];
  const selections = subjectIds
    .map((subjectId) => {
      const subject = subjects.find((s) => s.id === subjectId);
      const examBoardId = subject?.exam_boards[0]?.id;
      return examBoardId ? { subjectId, examBoardId } : null;
    })
    .filter((s): s is { subjectId: string; examBoardId: string } => s !== null);

  if (selections.length > 0) {
    await saveSubjectSelections(studentId, selections, false);
  }
}
