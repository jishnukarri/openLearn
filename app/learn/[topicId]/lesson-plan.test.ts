import { describe, expect, it } from "vitest";
import type { LessonSection } from "@/lib/ai/lessons";
import {
  buildLessonPlan,
  cardDefinition,
  clampStep,
  disabledReason,
  isFirstOfPhase,
  getCorrectAnswerLabel,
  recapSoFar,
  stageForStep,
  stepInstruction,
  stepLabel,
} from "./lesson-plan";

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

describe("navigation helpers", () => {
  const secs = [section(1), section(2), section(3)];
  const plan = buildLessonPlan(false, true, secs);

  it("labels steps without overflowing", () => {
    expect(stepLabel(2, 9)).toBe("Step 3 of 9");
    expect(stepLabel(20, 9)).toBe("Step 9 of 9");
  });
  it("maps phases to kid-friendly stages", () => {
    expect(stageForStep({ phase: "teach", sectionIndex: 0 })).toBe("Learn it");
    expect(stageForStep({ phase: "teach", sectionIndex: 0 }, true)).toBe("See an example");
    expect(stageForStep({ phase: "check", sectionIndex: 0 })).toBe("Try it");
    expect(stageForStep({ phase: "flashcard", cardIndices: [0, 1] })).toBe("Check yourself");
  });
  it("gives an imperative instruction per check kind", () => {
    expect(stepInstruction({ phase: "check", sectionIndex: 0 }, section(1))).toBe("Tap the answer you think is right.");
    const multi = { ...section(1), check: { kind: "multi", question: "q", options: ["a"], correctIndexes: [0] } } as LessonSection;
    expect(stepInstruction({ phase: "check", sectionIndex: 0 }, multi)).toMatch(/every answer/);
  });
  it("explains disabled buttons", () => {
    expect(disabledReason({ phase: "check", sectionIndex: 0 }, { hasAnswer: false })).toBe("Pick an answer first");
    expect(disabledReason({ phase: "tutor", sectionIndex: 0 }, { hasAnswer: true })).toBeNull();
    expect(disabledReason({ phase: "tutor", sectionIndex: 0 }, { hasAnswer: true, loading: true })).toMatch(/marking/);
  });
  it("recaps only sections already reached", () => {
    const firstCheck = plan.findIndex((s) => s.phase === "check");
    expect(recapSoFar(plan, 0, secs)).toEqual([]);
    expect(recapSoFar(plan, firstCheck, secs).map((r) => r.heading)).toEqual(["Concept 1"]);
    expect(recapSoFar(plan, plan.length - 1, secs)).toHaveLength(3);
  });
  it("clamps step index", () => {
    expect(clampStep(-1, 5)).toBe(0);
    expect(clampStep(9, 5)).toBe(4);
  });
  it("flags only the first step of each kind", () => {
    const firstCheck = plan.findIndex((s) => s.phase === "check");
    expect(isFirstOfPhase(plan, firstCheck)).toBe(true);
    expect(isFirstOfPhase(plan, plan.findIndex((s, i) => s.phase === "check" && i > firstCheck))).toBe(false);
  });
});
