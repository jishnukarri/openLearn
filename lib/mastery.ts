// Topic mastery blends the diagnostic with ongoing evidence, so the score
// can rise AND fall as the student works.
//
//   score = 0.3 * diagnostic
//         + 0.5 * accuracy * confidence
//         + (0.1 * lessonComplete + 0.1 * recallDone) * (1 - confidence * (1 - accuracy))
//
// accuracy   = recency-weighted marks ratio (half-life 14 days, newest 20 answers)
// confidence = min(1, effective attempts / 10), where effective attempts is the
//              sum of the same recency weights (old work fades, so inactivity
//              slowly lowers confidence)
// The completion bonus is discounted when recent accuracy is low, so finishing
// lessons cannot hold a score up on its own. Missing diagnostic counts as 0.

export const DIAGNOSTIC_WEIGHT = 0.3;
export const PRACTICE_WEIGHT = 0.5;
export const LESSON_WEIGHT = 0.1;
export const RECALL_WEIGHT = 0.1;
export const CONFIDENCE_ATTEMPTS = 10;
export const HALF_LIFE_DAYS = 14;
export const MAX_RECENT_ATTEMPTS = 20;

export type PracticeEvidence = { marksAwarded: number; marksPossible: number; attempts: number };

export type MasteryInput = {
  diagnostic: number | null;
  practice: PracticeEvidence | null;
  lessonComplete: boolean;
  recallDone?: boolean;
};

export type MasteryResult = {
  score: number;
  diagnosticPart: number;
  earnedPart: number;
  evidence: "none" | "some" | "strong";
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Recency-weight raw answers into PracticeEvidence (newest MAX_RECENT_ATTEMPTS only). */
export function weightPractice(
  answers: { marksAwarded: number; marksPossible: number; ageDays: number }[],
): PracticeEvidence | null {
  const recent = [...answers].sort((a, b) => a.ageDays - b.ageDays).slice(0, MAX_RECENT_ATTEMPTS);
  let awarded = 0, possible = 0, weight = 0;
  for (const a of recent) {
    if (a.marksPossible <= 0) continue;
    const w = Math.pow(0.5, Math.max(0, a.ageDays) / HALF_LIFE_DAYS);
    awarded += w * a.marksAwarded;
    possible += w * a.marksPossible;
    weight += w;
  }
  return possible > 0 ? { marksAwarded: awarded, marksPossible: possible, attempts: weight } : null;
}

export function computeMastery(input: MasteryInput): MasteryResult {
  const diagnosticPart = input.diagnostic === null ? 0 : clamp01(input.diagnostic) * DIAGNOSTIC_WEIGHT;
  const p = input.practice;
  const hasPractice = !!p && p.marksPossible > 0 && p.attempts > 0;
  const accuracy = hasPractice ? clamp01(p!.marksAwarded / p!.marksPossible) : 0;
  const confidence = hasPractice ? Math.min(1, p!.attempts / CONFIDENCE_ATTEMPTS) : 0;
  const bonusFactor = 1 - confidence * (1 - accuracy);
  const bonus = ((input.lessonComplete ? LESSON_WEIGHT : 0) + (input.recallDone ? RECALL_WEIGHT : 0)) * bonusFactor;
  const earnedPart = PRACTICE_WEIGHT * accuracy * confidence + bonus;
  const score = clamp01(diagnosticPart + earnedPart);
  const signals = (hasPractice ? 1 : 0) + (input.lessonComplete ? 1 : 0) + (input.recallDone ? 1 : 0);
  const evidence = !hasPractice && signals === 0 ? "none" : confidence >= 1 && signals >= 2 ? "strong" : "some";
  return { score, diagnosticPart, earnedPart, evidence };
}
