import { describe, expect, it } from "vitest";
import type { LessonSection } from "@/lib/ai/lessons";
import { buildLessonPlan, cardDefinition, getCorrectAnswerLabel } from "./lesson-plan";

const section = (i: number): LessonSection =>
  ({
    heading: `Concept ${i}`,
    explanation: `Explanation ${i}.`,
    example: `Example ${i}.`,
    check: { question: "Q?", options: ["a", "b", "c", "d"], correctIndex: 2 },
  }) as LessonSection;

describe("buildLessonPlan", () => {
  it("starts with the interactive and hook, ends with recap then done", () => {
    const plan = buildLessonPlan(true, true, [section(1), section(2), section(3)]);
    expect(plan[0]).toEqual({ phase: "interactive" });
    expect(plan[1]).toEqual({ phase: "hook" });
    expect(plan.at(-1)).toEqual({ phase: "recap" });
  });

  it("teaches then checks every section in order", () => {
    const plan = buildLessonPlan(false, false, [section(1), section(2)]);
    const teach = plan.filter((s) => s.phase === "teach").map((s) => (s as { sectionIndex: number }).sectionIndex);
    const check = plan.filter((s) => s.phase === "check").map((s) => (s as { sectionIndex: number }).sectionIndex);
    expect(teach).toEqual([0, 1]);
    expect(check).toEqual([0, 1]);
    expect(plan.findIndex((s) => s.phase === "teach")).toBeLessThan(plan.findIndex((s) => s.phase === "check"));
  });
});

describe("getCorrectAnswerLabel", () => {
  it("reads each check kind", () => {
    expect(getCorrectAnswerLabel({ question: "q", options: ["a", "b"], correctIndex: 1 })).toBe("b");
    expect(getCorrectAnswerLabel({ kind: "multi", question: "q", options: ["a", "b", "c"], correctIndexes: [0, 2] })).toBe("a, c");
    expect(getCorrectAnswerLabel({ kind: "short", question: "q", accepted: ["x", "y"] })).toBe("x");
    expect(getCorrectAnswerLabel({ kind: "matching", question: "q", pairs: [] })).toBe("");
  });
});

describe("cardDefinition", () => {
  it("uses the first sentence when it is short", () => {
    expect(cardDefinition("Energy is stored. It can move.")).toBe("Energy is stored.");
  });
  it("truncates long text", () => {
    expect(cardDefinition("x".repeat(300)).length).toBeLessThanOrEqual(131);
  });
});
