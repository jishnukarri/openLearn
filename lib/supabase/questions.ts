import "server-only";
import { db } from "./database-client";
import type { GeneratedQuestion, QuestionFormat } from "@/lib/ai/questions";
import type { MarkingResult } from "@/lib/ai/marking";

export type Question = {
  id: string;
  topic_id: string;
  prompt: string;
  markscheme: { point: string }[];
  max_marks: number;
  model_answer: string;
  format: QuestionFormat | null;
  section_index: number | null;
  bank_position: number | null;
  verified: boolean;
  image_url: string | null;
};

// classId omitted/null = the shared, topic-wide question every self-study
// student sees. A non-null classId is a fork generated for that class only.
const QUESTION_COLUMNS =
  "id, topic_id, prompt, markscheme, max_marks, model_answer, format, section_index, bank_position, verified, image_url";

const LEGACY_QUESTION_COLUMNS =
  "id, topic_id, prompt, markscheme, max_marks, model_answer, format";

// Rows come back from an untyped client, so this names the shape the
// selects above actually return.
type QuestionRow = Parameters<typeof normalizeQuestionRow>[0];

function normalizeQuestionRow(row: Partial<Question> & {
  id: string;
  topic_id: string;
  prompt: string;
  markscheme: { point: string }[];
  max_marks: number;
  model_answer: string;
  format: QuestionFormat | null;
}): Question {
  return {
    ...row,
    section_index: row.section_index ?? null,
    bank_position: row.bank_position ?? null,
    verified: row.verified ?? false,
    image_url: row.image_url ?? null,
  };
}

function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703";
}

export async function getQuestionForTopic(
  topicId: string,
  classId?: string | null
): Promise<Question | null> {
  const base = db
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(1);
  const query = classId ? base.eq("class_id", classId) : base.is("class_id", null);

  const full = await query.maybeSingle();
  if (!full.error) return full.data ? normalizeQuestionRow(full.data as QuestionRow) : null;
  if (!isMissingColumnError(full.error)) throw full.error;

  const legacyBase = db
    .from("questions")
    .select(LEGACY_QUESTION_COLUMNS)
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(1);
  const legacyQuery = classId ? legacyBase.eq("class_id", classId) : legacyBase.is("class_id", null);
  const legacy = await legacyQuery.maybeSingle();
  if (legacy.error) throw legacy.error;
  return legacy.data ? normalizeQuestionRow(legacy.data as QuestionRow) : null;
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const full = await db.from("questions").select(QUESTION_COLUMNS).eq("id", id).maybeSingle();
  if (!full.error) return full.data ? normalizeQuestionRow(full.data as QuestionRow) : null;
  if (!isMissingColumnError(full.error)) throw full.error;

  const legacy = await db.from("questions").select(LEGACY_QUESTION_COLUMNS).eq("id", id).maybeSingle();
  if (legacy.error) throw legacy.error;
  return legacy.data ? normalizeQuestionRow(legacy.data as QuestionRow) : null;
}

export async function listQuestionBankForTopic(topicId: string): Promise<Question[]> {
  const full = await db
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("topic_id", topicId)
    .order("bank_position", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (!full.error) return (full.data || []).map((row: QuestionRow) => normalizeQuestionRow(row));
  if (!isMissingColumnError(full.error)) throw full.error;

  const legacy = await db
    .from("questions")
    .select(LEGACY_QUESTION_COLUMNS)
    .eq("topic_id", topicId)
    .limit(1000);
  if (legacy.error) throw legacy.error;
  return (legacy.data || [])
    .map((row: QuestionRow) => normalizeQuestionRow(row))
    .sort((a: Question, b: Question) => {
      if (a.bank_position === null && b.bank_position === null) return a.id.localeCompare(b.id);
      if (a.bank_position === null) return 1;
      if (b.bank_position === null) return -1;
      return a.bank_position - b.bank_position;
    });
}

export async function createQuestionBank(
  topicId: string,
  questions: Array<GeneratedQuestion & { sectionIndex: number; bankPosition: number; imageUrl?: string | null }>
): Promise<Question[]> {
  const rows = questions.map((q) => ({
    topic_id: topicId,
    prompt: q.prompt,
    markscheme: q.markscheme,
    max_marks: q.maxMarks,
    model_answer: q.modelAnswer,
    format: q.format ?? null,
    section_index: q.sectionIndex,
    bank_position: q.bankPosition,
    verified: false,
    image_url: q.imageUrl ?? null,
  }));

  const { data, error } = await db
    .from("questions")
    .insert(rows)
    .select(QUESTION_COLUMNS);

  if (!error) return (data || []).map((row) => normalizeQuestionRow(row as QuestionRow));
  if (!isMissingColumnError(error)) throw error;

  const legacyRows = questions.map((q) => ({
    topic_id: topicId,
    prompt: q.prompt,
    markscheme: q.markscheme,
    max_marks: q.maxMarks,
    model_answer: q.modelAnswer,
    format: q.format ?? null,
  }));
  const legacy = await db.from("questions").insert(legacyRows).select(LEGACY_QUESTION_COLUMNS);
  if (legacy.error) throw legacy.error;
  return (legacy.data || []).map((row) => normalizeQuestionRow(row as QuestionRow));
}

export async function createQuestion(
  topicId: string,
  generated: GeneratedQuestion,
  classId?: string | null
): Promise<Question> {
  const { data, error } = await db
    .from("questions")
    .insert({
      topic_id: topicId,
      prompt: generated.prompt,
      markscheme: generated.markscheme,
      max_marks: generated.maxMarks,
      model_answer: generated.modelAnswer,
      format: generated.format ?? null,
      class_id: classId ?? null,
      section_index: generated.sectionIndex ?? null,
      bank_position: generated.bankPosition ?? null,
      verified: false,
      image_url: generated.imageUrl ?? null,
    })
    .select(QUESTION_COLUMNS)
    .single();

  if (!error) return normalizeQuestionRow(data as QuestionRow);
  if (!isMissingColumnError(error)) throw error;

  const legacy = await db
    .from("questions")
    .insert({
      topic_id: topicId,
      prompt: generated.prompt,
      markscheme: generated.markscheme,
      max_marks: generated.maxMarks,
      model_answer: generated.modelAnswer,
      format: generated.format ?? null,
      class_id: classId ?? null,
    })
    .select(LEGACY_QUESTION_COLUMNS)
    .single();
  if (legacy.error) throw legacy.error;
  return normalizeQuestionRow(legacy.data as QuestionRow);
}

// A subtopic's own question — kept separate from the topic-wide
// get/createQuestion for the same reason as lessons (see lessons.ts).
export async function getQuestionForSubtopic(subtopicId: string): Promise<Question | null> {
  const { data, error } = await db
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("subtopic_id", subtopicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeQuestionRow(data as QuestionRow) : null;
}

export async function createQuestionForSubtopic(
  topicId: string,
  subtopicId: string,
  generated: GeneratedQuestion
): Promise<Question> {
  const { data, error } = await db
    .from("questions")
    .insert({
      topic_id: topicId,
      subtopic_id: subtopicId,
      prompt: generated.prompt,
      markscheme: generated.markscheme,
      max_marks: generated.maxMarks,
      model_answer: generated.modelAnswer,
      format: generated.format ?? null,
    })
    .select(LEGACY_QUESTION_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeQuestionRow(data as QuestionRow);
}

// Highest marks this student has already earned on a question in the last 24
// hours. XP is only paid for improving on it, so repeating a question
// can't be farmed.
export async function getBestMarksLast24h(studentId: string, questionId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("student_answers")
    .select("marks_awarded")
    .eq("student_id", studentId)
    .eq("question_id", questionId)
    .gte("created_at", since);
  if (error) throw error;
  return Math.max(0, ...(data ?? []).map((r) => (r.marks_awarded as number) ?? 0));
}

export async function hasAnsweredQuestion(studentId: string, questionId: string): Promise<boolean> {
  const { count, error } = await db
    .from("student_answers")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("question_id", questionId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function recordAnswer(input: {
  questionId: string;
  studentId: string;
  answerText: string;
  maxMarks: number;
  result: MarkingResult;
}): Promise<void> {
  const { error } = await db.from("student_answers").insert({
    question_id: input.questionId,
    student_id: input.studentId,
    answer_text: input.answerText,
    marks_awarded: input.result.marksAwarded,
    max_marks: input.maxMarks,
    feedback: input.result.feedback,
  });
  if (error) throw error;
}

export async function updateQuestionVerification(
  questionId: string,
  verified: boolean,
  updatedFields?: Partial<Pick<Question, "prompt" | "model_answer" | "max_marks">>
): Promise<void> {
  const payload: Record<string, unknown> = { verified };
  if (updatedFields) {
    if (updatedFields.prompt !== undefined) payload.prompt = updatedFields.prompt;
    if (updatedFields.model_answer !== undefined) payload.model_answer = updatedFields.model_answer;
    if (updatedFields.max_marks !== undefined) payload.max_marks = updatedFields.max_marks;
  }
  const { error } = await db.from("questions").update(payload).eq("id", questionId);
  if (error) throw error;
}

export async function createQuestionSession(
  studentId: string,
  topicId: string,
  subtopicId?: string | null
): Promise<string> {
  const { data, error } = await db
    .from("question_sessions")
    .insert({ student_id: studentId, topic_id: topicId, subtopic_id: subtopicId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function isQuestionSessionOwner(sessionId: string, studentId: string): Promise<boolean> {
  const { data } = await db
    .from("question_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .maybeSingle();
  return data !== null;
}

export async function completeSession(
  sessionId: string,
  masteryExit: boolean
): Promise<void> {
  const { error } = await db
    .from("question_sessions")
    .update({ completed_at: new Date().toISOString(), mastery_exit: masteryExit })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function recordQuestionSessionAttempt(input: {
  questionId: string;
  studentId: string;
  sessionId: string;
  correct: boolean;
  isRetry?: boolean;
}): Promise<void> {
  const { error } = await db.from("question_session_attempts").insert({
    question_id: input.questionId,
    student_id: input.studentId,
    session_id: input.sessionId,
    correct: input.correct,
    is_retry: input.isRetry ?? false,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Generated hint / remediation cache. Lives in the question's `format` JSON
// (format.hints, format.remediation) so no migration is needed.
// ---------------------------------------------------------------------------

export function readFormatCache(format: unknown): { hints: unknown; remediation: unknown } {
  const f = (format && typeof format === "object" ? format : {}) as Record<string, unknown>;
  return { hints: f.hints, remediation: f.remediation };
}

// Merges `patch` into the stored format, re-reading the row first so keys
// written elsewhere (numeric answer, options...) are never clobbered. A null
// format becomes { type: "extended", ...patch }, matching how the app already
// treats a missing format.
export async function mergeQuestionFormat(
  questionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { data, error } = await db.from("questions").select("format").eq("id", questionId).maybeSingle();
  if (error) throw error;
  if (!data) return;
  const current = data.format && typeof data.format === "object" ? (data.format as Record<string, unknown>) : null;
  const next = current ? { ...current, ...patch } : { type: "extended", ...patch };
  const { error: updateError } = await db.from("questions").update({ format: next }).eq("id", questionId);
  if (updateError) throw updateError;
}
