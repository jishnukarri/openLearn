import { describe, expect, it } from "vitest";
import { computeMastery, DIAGNOSTIC_WEIGHT, weightPractice } from "./mastery";

const run = (n: number, ok: boolean, ageDays: number) =>
  Array.from({ length: n }, () => ({ marksAwarded: ok ? 4 : 0, marksPossible: 4, ageDays }));
const score = (answers: ReturnType<typeof run>, diagnostic: number | null = 0.8) =>
  computeMastery({ diagnostic, practice: weightPractice(answers), lessonComplete: true }).score;

describe("computeMastery", () => {
  it("is 0 with no data", () => {
    const r = computeMastery({ diagnostic: null, practice: null, lessonComplete: false });
    expect(r.score).toBe(0);
    expect(r.evidence).toBe("none");
  });
  it("diagnostic 1.0 alone gives 0.3", () => {
    const r = computeMastery({ diagnostic: 1, practice: null, lessonComplete: false });
    expect(r.score).toBeCloseTo(DIAGNOSTIC_WEIGHT);
  });
  it("practice without diagnostic still earns", () => {
    const r = computeMastery({ diagnostic: null, practice: { marksAwarded: 10, marksPossible: 10, attempts: 10 }, lessonComplete: false });
    expect(r.diagnosticPart).toBe(0);
    expect(r.score).toBeCloseTo(0.5);
  });
  it("strong practice approaches 1", () => {
    const r = computeMastery({ diagnostic: 1, practice: { marksAwarded: 20, marksPossible: 20, attempts: 20 }, lessonComplete: true, recallDone: true });
    expect(r.score).toBeCloseTo(1);
    expect(r.evidence).toBe("strong");
  });
  it("low-accuracy practice barely raises the score and discounts completion", () => {
    const base = computeMastery({ diagnostic: 0.5, practice: null, lessonComplete: false }).score;
    const r = computeMastery({ diagnostic: 0.5, practice: { marksAwarded: 1, marksPossible: 10, attempts: 10 }, lessonComplete: true });
    expect(r.score - base).toBeLessThan(0.1);
  });
  it("drops after a run of wrong answers and recovers after correct ones", () => {
    const good = run(10, true, 20);
    const high = score(good);
    const dropped = score([...good, ...run(8, false, 0)]);
    const recovered = score([...good, ...run(8, false, 3), ...run(10, true, 0)]);
    expect(dropped).toBeLessThan(high - 0.15);
    expect(recovered).toBeGreaterThan(dropped + 0.15);
  });
  it("old results fade in favour of recent ones", () => {
    expect(score([...run(10, false, 90), ...run(10, true, 0)])).toBeGreaterThan(score([...run(10, true, 90), ...run(10, false, 0)]));
  });
});
