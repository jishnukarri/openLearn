import "server-only";
import { createHash } from "node:crypto";
import { checkKeyRateLimit } from "@/lib/rate-limit";

export const ALREADY_RECORDED_MESSAGE = "That answer was just recorded. Give it a moment.";
export const ANSWER_LOCK_MS = 15_000;

export function answerLockKey(studentId: string, questionId: string, answerText: string): string {
  const digest = createHash("sha256").update(answerText).digest("hex").slice(0, 16);
  return `${studentId}:${questionId}:${digest}`;
}

// Short cross-instance idempotency lock (consume_rate_limit, 1 per 15s) so
// the same answer submitted twice at once is recorded and paid once.
export async function claimAnswerSlot(
  studentId: string,
  questionId: string,
  answerText: string,
  check: typeof checkKeyRateLimit = checkKeyRateLimit
): Promise<boolean> {
  return check("xp", answerLockKey(studentId, questionId, answerText), 1, ANSWER_LOCK_MS);
}
