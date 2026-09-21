import "server-only";
import { createServiceClient } from "./server";
import type {
  GeneratedDiagnosticQuestion,
  QuestionType,
} from "@/lib/ai/diagnostic";

type McqContent = { options: string[]; correctIndex: number };
type FillBlankContent = { blankAnswer: string };
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
  studentId: string;
  mode: "fresh" | "recap";
  questions: GeneratedDiagnosticQuestion[];
  subjectNameToId: Map<string, string>;
}): Promise<string> {
  const supabase = createServiceClient();

  const { data: session, error: sessionError } = await supabase
    .from("diagnostic_sessions")
    .insert({ student_id: input.studentId, mode: input.mode })
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
        type: q.type,
        prompt: q.prompt,
        max_marks: maxMarks,
        content,
        position: i,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: questionsError } = await supabase
    .from("diagnostic_questions")
    .insert(rows);
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
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("diagnostic_sessions")
    .select("student_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data?.student_id === studentId;
}

export async function getDiagnosticQuestions(
  sessionId: string
): Promise<DiagnosticQuestion[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
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
  const supabase = createServiceClient();
  const { error } = await supabase
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
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("diagnostic_questions")
    .select(
      "id, prompt, max_marks, content, diagnostic_answers!inner(score, answer_text)"
    )
    .eq("session_id", sessionId)
    .eq("type", "short_answer")
    .eq("diagnostic_answers.score", -1);
  if (error) throw error;

  return (data as any[])
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
  const supabase = createServiceClient();
  const { error } = await supabase
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
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("diagnostic_questions")
    .select("subject_id, topic_name, diagnostic_answers(score)")
    .eq("session_id", sessionId);
  if (error) throw error;

  const buckets = new Map<
    string,
    { subjectId: string; topicName: string | null; total: number; count: number }
  >();

  for (const row of data as any[]) {
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

  const { error: upsertError } = await supabase
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
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("diagnostic_questions")
    .select("topic_name, diagnostic_answers(score)")
    .eq("session_id", sessionId);
  if (error) throw error;

  const buckets = new Map<string, { total: number; count: number }>();
  for (const row of data as any[]) {
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
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("diagnostic_questions")
    .select(
      "id, topic_name, type, prompt, max_marks, content, diagnostic_answers(score, answer_text)"
    )
    .eq("session_id", sessionId)
    .order("position");
  if (error) throw error;

  return (data as any[]).map((row) => {
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
      correctAnswer = (c.pairs as { left: string; right: string }[])
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
