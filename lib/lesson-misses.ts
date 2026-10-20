import type { LessonCheck } from "@/lib/ai/lessons";

// Pure helpers for "ideas the student missed in lesson checks". No I/O.

export type LessonMiss = {
  id: string;
  topicId: string;
  subtopicId: string | null;
  prompt: string;
  correctAnswer: string;
  missedCount: number;
  lastMissedAt: string; // ISO
  resolved: boolean;
  /** Name of the lesson (topic) the miss came from. */
  lessonLabel: string;
};

export const MAX_PROMPT_CHARS = 500;
export const COACH_MISS_LIMIT = 3;
export const PREVIOUS_LESSONS_LOOKED_BACK = 2;

export const missPrompt = (question: string) => question.trim().slice(0, MAX_PROMPT_CHARS);

/** Plain-text correct answer for a check, whatever its kind. */
export function checkAnswerText(check: LessonCheck): string {
  switch (check.kind) {
    case "multi":
      return check.correctIndexes.map((i) => check.options[i]).filter(Boolean).join("; ");
    case "short":
      return check.accepted[0] ?? "";
    case "matching":
      return check.pairs.map((p) => `${p.left} = ${p.right}`).join("; ");
    default:
      return check.options[check.correctIndex] ?? "";
  }
}

/**
 * Unresolved misses worth revisiting: this topic first, then the previous
 * lessons (nearest first), each group most-missed then most recent.
 * `previousTopicIds` is ordered nearest-first.
 */
export function rankLessonMisses(
  misses: LessonMiss[],
  input: { topicId: string; previousTopicIds: string[]; limit?: number }
): LessonMiss[] {
  const order = new Map<string, number>([[input.topicId, 0]]);
  input.previousTopicIds.slice(0, PREVIOUS_LESSONS_LOOKED_BACK).forEach((id, i) => order.set(id, i + 1));
  return misses
    .filter((m) => !m.resolved && order.has(m.topicId))
    .sort(
      (a, b) =>
        order.get(a.topicId)! - order.get(b.topicId)! ||
        b.missedCount - a.missedCount ||
        b.lastMissedAt.localeCompare(a.lastMissedAt)
    )
    .slice(0, input.limit ?? 3);
}

/** The one true sentence shown beside a carried-over question. */
export function missNote(m: Pick<LessonMiss, "lessonLabel">): string {
  return `You found this tricky in ${m.lessonLabel} — try it again`;
}

/** Topic ids of the lessons just before `position` in the same subject, nearest first. */
export function previousTopicIds(topics: { id: string; position: number }[], position: number): string[] {
  return topics
    .filter((t) => t.position < position)
    .sort((a, b) => b.position - a.position)
    .slice(0, PREVIOUS_LESSONS_LOOKED_BACK)
    .map((t) => t.id);
}
