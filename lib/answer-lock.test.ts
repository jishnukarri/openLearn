import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({ checkKeyRateLimit: vi.fn() }));

import { answerLockKey, claimAnswerSlot, ANSWER_LOCK_MS } from "./answer-lock";

describe("answer lock", () => {
  it("keys differ per answer and are stable", () => {
    expect(answerLockKey("s", "q", "a")).toBe(answerLockKey("s", "q", "a"));
    expect(answerLockKey("s", "q", "a")).not.toBe(answerLockKey("s", "q", "b"));
  });
  it("passes through the limiter result with 1 per window", async () => {
    const check = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await claimAnswerSlot("s", "q", "a", check)).toBe(true);
    expect(await claimAnswerSlot("s", "q", "a", check)).toBe(false);
    expect(check).toHaveBeenCalledWith("xp", expect.stringContaining("s:q:"), 1, ANSWER_LOCK_MS);
  });
});
