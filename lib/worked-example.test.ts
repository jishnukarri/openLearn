import { describe, it, expect } from "vitest";
import { deriveExampleSteps, resolveExampleSteps, visibleCount } from "./worked-example";

describe("deriveExampleSteps", () => {
  it("splits sentences", () => {
    expect(deriveExampleSteps("Carbon has 6 protons. So its atomic number is 6. The answer is 6.")).toHaveLength(3);
  });
  it("splits on newlines and strips numbering", () => {
    expect(deriveExampleSteps("1. Add them\n2) Divide by 2")).toEqual(["Add them", "Divide by 2"]);
  });
  it("does not split inside maths", () => {
    expect(deriveExampleSteps("Work out $v = 3.5 \\times 2$. Then state it.")).toEqual(["Work out $v = 3.5 \\times 2$.", "Then state it."]);
  });
  it("folds extra steps into the last and handles empty", () => {
    const s = deriveExampleSteps("A. B. C. D. E. F. G. H.", 4);
    expect(s).toHaveLength(4);
    expect(s[3]).toContain("H.");
    expect(deriveExampleSteps("  ")).toEqual([]);
  });
});

describe("resolveExampleSteps / visibleCount", () => {
  it("prefers authored steps", () => {
    expect(resolveExampleSteps({ example: "x. y.", exampleSteps: [" one ", ""] })).toEqual(["one"]);
    expect(resolveExampleSteps({ example: "Do a. Do b." })).toHaveLength(2);
  });
  it("reveals progressively or all", () => {
    expect(visibleCount(0, 4, false)).toBe(1);
    expect(visibleCount(9, 4, false)).toBe(4);
    expect(visibleCount(0, 4, true)).toBe(4);
  });
});
