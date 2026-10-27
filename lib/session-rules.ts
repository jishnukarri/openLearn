// Server-side derivation of practice-session flags. The browser's isRetry /
// masteryExit values are no longer trusted; these read the recorded attempts.

// Same threshold as the bank player.
export const MASTERY_THRESHOLD = 4;

export type SessionAttempt = { question_id: string; correct: boolean; is_retry: boolean };

// A retry is any attempt at a question that already has an earlier attempt in
// this session.
export function deriveIsRetry(attempts: SessionAttempt[], questionId: string): boolean {
  return attempts.some((a) => a.question_id === questionId);
}

// Mastery = MASTERY_THRESHOLD distinct questions answered correctly on their
// first (non-retry) attempt.
export function deriveMasteryExit(attempts: SessionAttempt[], threshold = MASTERY_THRESHOLD): boolean {
  const firstTry = new Set<string>();
  for (const a of attempts) if (!a.is_retry && a.correct) firstTry.add(a.question_id);
  return firstTry.size >= threshold;
}
