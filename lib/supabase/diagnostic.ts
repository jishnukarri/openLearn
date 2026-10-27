import "server-only";
import { db } from "./database-client";
import type {
  GeneratedDiagnosticQuestion,
  QuestionType,
} from "@/lib/ai/diagnostic";
import { numericMetaFrom } from "@/lib/diagnostic-numeric";

type McqContent = { options: string[]; correctIndex: number };
type FillBlankContent = { blankAnswer: string; numeric?: import("@/lib/diagnostic-numeric").NumericMeta };
type MatchContent = { pairs: { left: string; right: string }[] };
type ShortAnswerContent = { markscheme: { point: string }[] };

export type DiagnosticQuestion = {
  id: string;
  subject_id: string;
  topic_name: string | null;
  type: QuestionType;
  prompt: string;
  max_marks: number;
  content: McqContent | FillBlankContent | MatchContent | ShortAnswerContent;
  position: number;
};

export async function createDiagnosticSession(input: {
  studentId?: string;
  guestToken?: string;
  mode: "fresh" | "recap";
  questions: GeneratedDiagnosticQuestion[];
  subjectNameToId: Map<string, string>;
}): Promise<string> {
  if (!input.studentId && !input.guestToken) {
    throw new Error("createDiagnosticSession needs either a studentId or a guestToken.");
  }

  const { data: session, error: sessionError } = await db
    .from("diagnostic_sessions")
    .insert({
      student_id: input.studentId ?? null,
      guest_token: input.guestToken ?? null,
      mode: input.mode,
    })
    .select("id")
    .single();
  if (sessionError) throw sessionError;

  const rows = input.questions
    .map((q, i) => {
      const subjectId = input.subjectNameToId.get(q.subjectName);
      if (!subjectId) return null;

      let content: DiagnosticQuestion["content"];
      let maxMarks = q.maxMarks || 1;
      switch (q.type) {
        case "mcq":
          content = { options: q.options, correctIndex: q.correctIndex };
          maxMarks = 1;
          break;
        case "fill_blank":
          content = { blankAnswer: q.blankAnswer };
          maxMarks = 1;
          break;
        case "numeric":
          content = { blankAnswer: q.blankAnswer, numeric: numericMetaFrom(q) };
          maxMarks = q.maxMarks || 1;
          break;
        case "match":
          content = { pairs: q.matchPairs };
          maxMarks = q.matchPairs.length || 1;
          break;
        case "short_answer":
          content = { markscheme: q.markscheme };
          break;
      }

      return {
        session_id: session.id,
        subject_id: subjectId,
        topic_name: q.topicName || null,
        type: q.type === "numeric" ? "fill_blank" : q.type,
        prompt: q.prompt,
        max_marks: maxMarks,
        content,
        position: i,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: questionsError } = await db
    .from("diagnostic_questions")
    .insert(rows);
  if (questionsError) throw questionsError;

  return session.id;
}

// Same shape as createDiagnosticSession, but for questions that already
// exist (sampled from a topic's pre-generated pool) instead of freshly
// AI-generated ones — used by the guest-onboarding diagnostic.
export async function createDiagnosticSessionFromPool(input: {
  guestToken?: string;
  studentId?: string;
  mode?: "fresh" | "recap";
  questions: Array<{
    subjectId: string;
    topicName: string | null;
    type: QuestionType;
    prompt: string;
    maxMarks: number;
    content: DiagnosticQuestion["content"];
  }>;
}): Promise<string> {
  if (!input.studentId && !input.guestToken) {
    throw new Error("createDiagnosticSessionFromPool needs either a studentId or a guestToken.");
  }
  const { data: session, error: sessionError } = await db
    .from("diagnostic_sessions")
    .insert({
      student_id: input.studentId ?? null,
      guest_token: input.guestToken ?? null,
      mode: input.mode ?? "fresh",
    })
    .select("id")
    .single();
  if (sessionError) throw sessionError;

  const rows = input.questions.map((q, i) => ({
    session_id: session.id,
    subject_id: q.subjectId,
    topic_name: q.topicName,
    type: q.type,
    prompt: q.prompt,
    max_marks: q.maxMarks,
    content: q.content,
    position: i,
  }));

  const { error: questionsError } = await db.from("diagnostic_questions").insert(rows);
  if (questionsError) throw questionsError;

  return session.id;
}

// Verifies a diagnostic session belongs to the given student before any
// page or action reads/writes it — session IDs are plain UUIDs in the URL,
// so without this check any logged-in student could view or answer
// another student's in-progress diagnostic just by guessing/sharing a link.
export async function isDiagnosticSessionOwner(
  sessionId: string,
  studentId: string
): Promise<boolean> {
  const { data, error } = await db
    .from("diagnostic_sessions")
    .select("student_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data?.student_id === studentId;
}

export async function isGuestSessionOwner(
  sessionId: string,
  guestToken: string
): Promise<boolean> {
  const { data, error } = await db
    .from("diagnostic_sessions")
    .select("guest_token")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return !!data?.guest_token && data.guest_token === guestToken;
}

// Finds this browser's in-progress guest session, if the 2-day window
// hasn't lapsed — used to offer "continue where you left off?" on return.
// An expired, never-converted row is deleted rather than reused.
export async function getActiveGuestSession(
  guestToken: string
): Promise<{ id: string; createdAt: string } | null> {
  const { data, error } = await db
    .from("diagnostic_sessions")
    .select("id, created_at, status")
    .eq("guest_token", guestToken)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const ageMs = Date.now() - new Date(data.created_at).getTime();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  if (ageMs > twoDaysMs) {
    await db.from("diagnostic_sessions").delete().eq("id", data.id);
    return null;
  }
  return { id: data.id, createdAt: data.created_at };
}

export async function deleteDiagnosticSession(sessionId: string): Promise<void> {
  const { error } = await db.from("diagnostic_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

// Attaches a completed guest diagnostic to a brand-new account — the guest's
// effort becomes their real onboarding diagnostic instead of being thrown
// away. Caller still needs to run buildKnowledgeModel afterward (it needs a
// real studentId, which this session didn't have until now).
export async function convertGuestSession(
  sessionId: string,
  studentId: string
): Promise<void> {
  const { error } = await db
    .from("diagnostic_sessions")
    .update({ student_id: studentId, status: "converted" })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function getDiagnosticQuestions(
  sessionId: string
): Promise<DiagnosticQuestion[]> {
  const { data, error } = await db
    .from("diagnostic_questions")
    .select("id, subject_id, topic_name, type, prompt, max_marks, content, position")
    .eq("session_id", sessionId)
    .order("position");

  if (error) throw error;
  return data;
}

export async function recordDiagnosticAnswer(
  questionId: string,
  score: number,
  selectedIndex?: number | null,
  answerText?: string | null
): Promise<void> {
  const { error } = await db
    .from("diagnostic_answers")
    .upsert({
      question_id: questionId,
      score,
      selected_index: selectedIndex ?? null,
      answer_text: answerText ?? null,
    });
  if (error) throw error;
}

// Returns all short_answer questions for a session that still need AI marking
// (score stored as -1 during the quiz, replaced in batch at the end).
export async function getPendingShortAnswers(sessionId: string): Promise<
  Array<{
    questionId: string;
    prompt: string;
    markscheme: { point: string }[];
    maxMarks: number;
    answerText: string;
  }>
> {
  const { data, error } = await db
    .from("diagnostic_questions")
    .select(
      "id, prompt, max_marks, content, diagnostic_answers!inner(score, answer_text)"
    )
    .eq("session_id", sessionId)
    .eq("type", "short_answer")
    .eq("diagnostic_answers.score", -1);
  if (error) throw error;

  type PendingRow = {
    id: string;
    prompt: string;
    max_marks: number;
    content: unknown;
    diagnostic_answers:
      | { score: number; answer_text: string | null }
      | { score: number; answer_text: string | null }[]
      | null;
  };
  return (data as unknown as PendingRow[])
    .map((row) => {
      // diagnostic_answers.question_id is that table's primary key, so this
      // is a to-one relationship — PostgREST embeds it as a single object,
      // not an array. Indexing with [0] here always returned undefined,
      // which silently dropped every pending short answer from marking.
      const ans = Array.isArray(row.diagnostic_answers)
        ? row.diagnostic_answers[0]
        : row.diagnostic_answers;
      if (!ans?.answer_text) return null;
      return {
        questionId: row.id,
        prompt: row.prompt,
        markscheme: (row.content as { markscheme: { point: string }[] }).markscheme,
        maxMarks: row.max_marks,
        answerText: ans.answer_text,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

export async function updateAnswerScore(
  questionId: string,
  score: number
): Promise<void> {
  const { error } = await db
    .from("diagnostic_answers")
    .update({ score })
    .eq("question_id", questionId);
  if (error) throw error;
}

// Aggregates answered questions into a per-subject/topic proficiency score.
// "Weak" (< 60%) topics are what onboarding should flag for reteaching.
export async function buildKnowledgeModel(
  sessionId: string,
  studentId: string
): Promise<void> {

  const { data, error } = await db
    .from("diagnostic_questions")
    .select("subject_id, topic_name, diagnostic_answers(score)")
    .eq("session_id", sessionId);
  if (error) throw error;

  const buckets = new Map<
    string,
    { subjectId: string; topicName: string | null; total: number; count: number }
  >();

  type SubjectTopicRow = {
    subject_id: string;
    topic_name: string | null;
    diagnostic_answers: { score: number } | { score: number }[] | null;
  };
  for (const row of data as unknown as SubjectTopicRow[]) {
    const key = `${row.subject_id}:${row.topic_name ?? ""}`;
    const bucket = buckets.get(key) ?? {
      subjectId: row.subject_id,
      topicName: row.topic_name,
      total: 0,
      count: 0,
    };
    const answers = Array.isArray(row.diagnostic_answers)
      ? row.diagnostic_answers
      : row.diagnostic_answers
        ? [row.diagnostic_answers]
        : [];
    for (const answer of answers) {
      bucket.total += answer.score;
      bucket.count += 1;
    }
    buckets.set(key, bucket);
  }

  const rows = Array.from(buckets.values())
    .filter((b) => b.count > 0)
    .map((b) => ({
      student_id: studentId,
      subject_id: b.subjectId,
      topic_name: b.topicName,
      score: b.total / b.count,
      weak: b.total / b.count < 0.6,
    }));

  if (rows.length === 0) return;

  const { error: upsertError } = await db
    .from("knowledge_model")
    .upsert(rows, { onConflict: "student_id,subject_id,topic_name" });
  if (upsertError) throw upsertError;
}

export type TopicResult = {
  topicName: string;
  score: number;
};

export async function getSessionResultsByTopic(
  sessionId: string
): Promise<TopicResult[]> {
  const { data, error } = await db
    .from("diagnostic_questions")
    .select("topic_name, diagnostic_answers(score)")
    .eq("session_id", sessionId);
  if (error) throw error;

  const buckets = new Map<string, { total: number; count: number }>();
  type TopicRow = {
    topic_name: string | null;
    diagnostic_answers: { score: number } | { score: number }[] | null;
  };
  for (const row of data as unknown as TopicRow[]) {
    const key = row.topic_name ?? "General";
    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    const answers = Array.isArray(row.diagnostic_answers)
      ? row.diagnostic_answers
      : row.diagnostic_answers
        ? [row.diagnostic_answers]
        : [];
    for (const answer of answers) {
      // Skip placeholder scores from unanswered / pending questions.
      if (answer.score < 0) continue;
      bucket.total += answer.score;
      bucket.count += 1;
    }
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, b]) => b.count > 0)
    .map(([topicName, b]) => ({ topicName, score: b.total / b.count }));
}

export type QuestionReview = {
  id: string;
  topicName: string | null;
  type: QuestionType;
  prompt: string;
  score: number;
  maxMarks: number;
  answerText: string | null;
  correctAnswer: string | null; // human-readable correct answer for display
};

export async function getSessionQuestionReviews(
  sessionId: string
): Promise<QuestionReview[]> {
  const { data, error } = await db
    .from("diagnostic_questions")
    .select(
      "id, topic_name, type, prompt, max_marks, content, diagnostic_answers(score, answer_text)"
    )
    .eq("session_id", sessionId)
    .order("position");
  if (error) throw error;

  type ReviewRow = {
    id: string;
    topic_name: string | null;
    type: QuestionReview["type"];
    prompt: string;
    max_marks: number;
    content: {
      options?: string[];
      correctIndex: number;
      blankAnswer?: string;
      pairs: { left: string; right: string }[];
    };
    diagnostic_answers:
      | { score: number | null; answer_text: string | null }
      | { score: number | null; answer_text: string | null }[]
      | null;
  };
  return (data as unknown as ReviewRow[]).map((row) => {
    // Same to-one embed shape as getPendingShortAnswers above — an object,
    // not an array. The old [0] index always missed, defaulting every
    // question's score to 0 regardless of how it was actually answered.
    const embedded = Array.isArray(row.diagnostic_answers)
      ? row.diagnostic_answers[0]
      : row.diagnostic_answers;
    const ans = embedded ?? { score: 0, answer_text: null };
    let correctAnswer: string | null = null;
    const c = row.content;
    if (row.type === "mcq") correctAnswer = c.options?.[c.correctIndex] ?? null;
    else if (row.type === "fill_blank") correctAnswer = c.blankAnswer ?? null;
    else if (row.type === "match")
      correctAnswer = c.pairs
        .map((p) => `${p.left} → ${p.right}`)
        .join(", ");

    return {
      id: row.id,
      topicName: row.topic_name,
      type: row.type,
      prompt: row.prompt,
      score: Math.max(0, ans.score ?? 0),
      maxMarks: row.max_marks,
      answerText: ans.answer_text ?? null,
      correctAnswer,
    };
  });
}
