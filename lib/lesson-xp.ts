// Lesson XP by performance. Pure: the server calls this with numbers it has
// clamped itself, so the client can never claim more than the formula allows.
//
//   completing the lesson          8 XP
//   accuracy (checks right 1st go) up to 12 XP, 12 * firstTryCorrect / checksTotal, rounded
//   each hint used                 -1 XP
//   floor                          5 XP (finishing always pays something real)
//   cap                            20 XP (all right first time, no hints)
//   repeat completion              2..5 XP: 2 + round(3 * accuracy share), no hint penalty
//                                  (so replaying cannot be farmed)

export const LESSON_XP_BASE = 8;
export const LESSON_XP_ACCURACY_MAX = 12;
export const LESSON_XP_FLOOR = 5;
export const LESSON_XP_MAX = LESSON_XP_BASE + LESSON_XP_ACCURACY_MAX;
export const LESSON_XP_REPEAT_MAX = 5;
export const LESSON_XP_REPEAT_MIN = 2;

export type LessonPerformance = { firstTryCorrect: number; checksTotal: number; hintsUsed: number };

export type LessonXpResult = {
  total: number;
  completion: number; // base for finishing
  accuracy: number; // points from first-try answers
  hintPenalty: number; // XP lost to hints (after the floor is applied)
  bonus: number; // lifted to the floor, when low scores would have gone under it
  repeat: boolean;
  hintsUsed: number;
};

const int = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
};

/** Clamp untrusted client numbers against the server's own checks count. */
export function clampPerformance(raw: Partial<LessonPerformance> | null | undefined, serverChecksTotal: number): LessonPerformance {
  const checksTotal = int(serverChecksTotal, 0, 40);
  return {
    checksTotal,
    firstTryCorrect: int(raw?.firstTryCorrect, 0, checksTotal),
    hintsUsed: int(raw?.hintsUsed, 0, 99),
  };
}

export function lessonXp(perf: LessonPerformance, opts: { repeat?: boolean } = {}): LessonXpResult {
  const { firstTryCorrect, checksTotal, hintsUsed } = perf;
  const share = checksTotal > 0 ? Math.min(1, firstTryCorrect / checksTotal) : 1;

  if (opts.repeat) {
    const total = Math.min(LESSON_XP_REPEAT_MAX, LESSON_XP_REPEAT_MIN + Math.round(3 * share));
    return { total, completion: LESSON_XP_REPEAT_MIN, accuracy: total - LESSON_XP_REPEAT_MIN, hintPenalty: 0, bonus: 0, repeat: true, hintsUsed };
  }

  const accuracy = Math.round(LESSON_XP_ACCURACY_MAX * share);
  const raw = LESSON_XP_BASE + accuracy - hintsUsed;
  const total = Math.max(LESSON_XP_FLOOR, Math.min(LESSON_XP_MAX, raw));
  const bonus = Math.max(0, total - raw);
  const hintPenalty = Math.max(0, LESSON_XP_BASE + accuracy - total);
  return { total, completion: LESSON_XP_BASE, accuracy, hintPenalty, bonus, repeat: false, hintsUsed };
}

/** One line for the completion screen. */
export function xpBreakdownLine(r: LessonXpResult): string {
  if (r.repeat) return "Repeat lesson: a small amount, since you already finished this one.";
  const parts = [`${r.completion} for finishing`, `${r.accuracy} for answers`];
  if (r.bonus > 0) parts.push(`${r.bonus} bonus`);
  const line = parts.join(", ");
  return r.hintsUsed > 0
    ? `${line}; ${r.hintsUsed} ${r.hintsUsed === 1 ? "hint" : "hints"} used${r.hintPenalty > 0 ? ` (-${r.hintPenalty})` : ""}`
    : line;
}
