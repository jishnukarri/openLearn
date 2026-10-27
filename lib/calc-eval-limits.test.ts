import { describe, it, expect } from "vitest";
import { evaluateExpression } from "./calc-eval";
import { damerauLevenshtein, matchesExpected } from "./spelling";

describe("calc-eval limits", () => {
  it("rejects huge/pathological input quickly", () => {
    const t = Date.now();
    expect(evaluateExpression("1+".repeat(100000) + "1")).toBeNull();
    expect(evaluateExpression("(".repeat(5000) + "1" + ")".repeat(5000))).toBeNull();
    expect(evaluateExpression("-".repeat(150) + "1")).toBeNull();
    expect(evaluateExpression("9^9^9")).toBeNull();
    expect(evaluateExpression("1e999")).toBeNull();
    expect(Date.now() - t).toBeLessThan(500);
  });
  it("still evaluates normal input", () => {
    expect(evaluateExpression("2(3+1)")).toBe(8);
    expect(evaluateExpression("((2+3)*4)^2")).toBe(400);
  });
});

describe("spelling caps", () => {
  it("is fast and false on very long input", () => {
    const t = Date.now();
    const long = "a".repeat(100000);
    expect(matchesExpected(long, "photosynthesis").matched).toBe(false);
    expect(damerauLevenshtein(long, long + "b")).toBeGreaterThan(1);
    expect(Date.now() - t).toBeLessThan(500);
  });
  it("handles empty strings", () => {
    expect(matchesExpected("", "").matched).toBe(false);
    expect(matchesExpected("cat", "").matched).toBe(false);
  });
});
