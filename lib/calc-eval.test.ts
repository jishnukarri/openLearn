import { describe, expect, it } from "vitest";
import { evaluateExpression, formatResult } from "./calc-eval";

describe("evaluateExpression", () => {
  it("handles precedence, brackets and unicode operators", () => {
    expect(evaluateExpression("2+3×4")).toBe(14);
    expect(evaluateExpression("(2+3)×4")).toBe(20);
    expect(evaluateExpression("10÷4−1")).toBe(1.5);
  });
  it("handles powers, sqrt, ans and implicit multiplication", () => {
    expect(evaluateExpression("2^3^2")).toBe(512);
    expect(evaluateExpression("-2^2")).toBe(-4);
    expect(evaluateExpression("√(16)+1")).toBe(5);
    expect(evaluateExpression("2(3+1)")).toBe(8);
    expect(evaluateExpression("ans×2", 21)).toBe(42);
    expect(evaluateExpression("6.02e23÷2")).toBeCloseTo(3.01e23);
  });
  it("rejects bad input", () => {
    expect(evaluateExpression("2+")).toBeNull();
    expect(evaluateExpression("1/0")).toBeNull();
    expect(evaluateExpression("alert(1)")).toBeNull();
    expect(evaluateExpression("√(-4)")).toBeNull();
    expect(evaluateExpression("(1")).toBeNull();
  });
  it("formats away float noise", () => {
    expect(formatResult(0.1 + 0.2)).toBe("0.3");
  });
});
