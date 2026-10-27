import { describe, expect, it } from "vitest";
import { deriveIsRetry, deriveMasteryExit, type SessionAttempt } from "./session-rules";

const a = (q: string, correct: boolean, is_retry = false): SessionAttempt => ({ question_id: q, correct, is_retry });

describe("deriveIsRetry", () => {
  it("is false with no prior attempt for the question", () => {
    expect(deriveIsRetry([], "q1")).toBe(false);
    expect(deriveIsRetry([a("q2", true)], "q1")).toBe(false);
  });
  it("is true once the question has an earlier attempt", () => {
    expect(deriveIsRetry([a("q1", false)], "q1")).toBe(true);
  });
});

describe("deriveMasteryExit", () => {
  it("needs 4 first-try correct answers", () => {
    expect(deriveMasteryExit([a("1", true), a("2", true), a("3", true)])).toBe(false);
    expect(deriveMasteryExit([a("1", true), a("2", true), a("3", true), a("4", true)])).toBe(true);
  });
  it("ignores retries and wrong answers", () => {
    expect(deriveMasteryExit([a("1", true), a("2", true), a("3", true), a("4", true, true), a("5", false)])).toBe(false);
  });
  it("counts each question once", () => {
    expect(deriveMasteryExit([a("1", true), a("1", true), a("1", true), a("1", true)])).toBe(false);
  });
});
