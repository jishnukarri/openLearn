// Pure ranking for the post-teaching "Do it now" practice. No I/O, no AI:
// it only reorders questions that already exist, using what the student has
// already got wrong or marked low.

export type PracticeCandidate = {
  id: string;
  prompt: string;
  modelAnswer: string;
  points: string[];
  maxMarks: number;
  subtopicId: string | null;
};

export type AnswerHistory = { questionId: string; marksAwarded: number; maxMarks: number };
export type AttemptHistory = { questionId: string; correct: boolean };

export type PracticeItem = PracticeCandidate & { missed: boolean };
export type LessonPractice = { items: PracticeItem[]; reason: string };

export const PRACTICE_LIMIT = 3;
const WEAK_MASTERY = 0.6;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Number of times the student missed or low-marked each question. */
export function missCounts(answers: AnswerHistory[], attempts: AttemptHistory[]): Map<string, number> {
  const out = new Map<string, number>();
  const bump = (id: string) => out.set(id, (out.get(id) ?? 0) + 1);
  for (const a of answers) if (a.maxMarks > 0 && a.marksAwarded < a.maxMarks) bump(a.questionId);
  for (const t of attempts) if (!t.correct) bump(t.questionId);
  return out;
}

/**
 * Pick up to `limit` questions, most-missed first. Returns null when there is
 * nothing true to say about this student, so the caller falls back to the
 * lesson's default activity. Ties break on a per-student hash so two students
 * with the same history can still see different picks.
 */
export function rankPractice(input: {
  studentId: string;
  candidates: PracticeCandidate[];
  answers: AnswerHistory[];
  attempts: AttemptHistory[];
  subtopicId?: string | null;
  mastery?: number | null; // 0..1 for this topic, null when unknown
  topicLabel: string;
  subtopicLabel?: string | null;
  limit?: number;
}): LessonPractice | null {
  const limit = input.limit ?? PRACTICE_LIMIT;
  const misses = missCounts(input.answers, input.attempts);
  const weak = input.mastery != null && input.mastery < WEAK_MASTERY;
  const scored = input.candidates
    .map((c) => {
      const m = misses.get(c.id) ?? 0;
      const inSub = !!input.subtopicId && c.subtopicId === input.subtopicId;
      return { c, m, score: m * 10 + (m > 0 && inSub ? 3 : 0) + (inSub ? 1 : 0) };
    })
    .filter((x) => x.m > 0)
    .sort((a, b) => b.score - a.score || hash(input.studentId + a.c.id) - hash(input.studentId + b.c.id));
  if (scored.length === 0) return null;
  const picked = scored.slice(0, limit);
  const inSubPick = !!input.subtopicId && picked.some((p) => p.c.subtopicId === input.subtopicId);
  const label = inSubPick && input.subtopicLabel ? input.subtopicLabel : input.topicLabel;
  const reason = weak
    ? `Picked because you found ${label} tricky last time, and it is one of your weaker areas.`
    : `Picked because you found ${label} tricky last time.`;
  return { items: picked.map((p) => ({ ...p.c, missed: true })), reason };
}
