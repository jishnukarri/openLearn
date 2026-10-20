import { describe, expect, it } from "vitest";
import { clampPerformance, lessonXp, xpBreakdownLine } from "./lesson-xp";

describe("lessonXp", () => {
  it("pays the full 20 only for a perfect, hint-free run", () => {
    expect(lessonXp({ firstTryCorrect: 5, checksTotal: 5, hintsUsed: 0 }).total).toBe(20);
    expect(lessonXp({ firstTryCorrect: 4, checksTotal: 5, hintsUsed: 0 }).total).toBeLessThan(20);
    expect(lessonXp({ firstTryCorrect: 5, checksTotal: 5, hintsUsed: 1 }).total).toBe(19);
  });
  it("reduces for misses and hints but never below 5", () => {
    expect(lessonXp({ firstTryCorrect: 0, checksTotal: 5, hintsUsed: 0 }).total).toBe(8);
    expect(lessonXp({ firstTryCorrect: 0, checksTotal: 5, hintsUsed: 9 }).total).toBe(5);
  });
  it("treats a lesson without checks as full accuracy", () => {
    expect(lessonXp({ firstTryCorrect: 0, checksTotal: 0, hintsUsed: 0 }).total).toBe(20);
  });
  it("caps repeats at 5", () => {
    const r = lessonXp({ firstTryCorrect: 5, checksTotal: 5, hintsUsed: 0 }, { repeat: true });
    expect(r.total).toBe(5);
    expect(lessonXp({ firstTryCorrect: 0, checksTotal: 5, hintsUsed: 3 }, { repeat: true }).total).toBe(2);
  });
  it("breakdown components add up", () => {
    const r = lessonXp({ firstTryCorrect: 3, checksTotal: 5, hintsUsed: 2 });
    expect(r.completion + r.accuracy + r.bonus - r.hintPenalty).toBe(r.total);
    expect(xpBreakdownLine(r)).toContain("2 hints used");
  });
});

describe("clampPerformance", () => {
  it("never trusts the client past the server's check count", () => {
    expect(clampPerformance({ firstTryCorrect: 99, checksTotal: 99, hintsUsed: -4 }, 5)).toEqual({ firstTryCorrect: 5, checksTotal: 5, hintsUsed: 0 });
    expect(clampPerformance({ firstTryCorrect: NaN }, 3).firstTryCorrect).toBe(0);
    expect(clampPerformance(null, 3)).toEqual({ firstTryCorrect: 0, checksTotal: 3, hintsUsed: 0 });
  });
});
