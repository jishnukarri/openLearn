import { describe, expect, it } from "vitest";
import type { LessonSection } from "@/lib/ai/lessons";
import { buildLessonPlan } from "@/app/learn/[topicId]/lesson-plan";
import {
  buildCoachContext,
  clampIndex,
  coveredSectionSet,
  sanitizePlan,
  sanitizeSession,
  summarizeHistory,
  summarizeSession,
} from "./lesson-coach-context";

const secs: LessonSection[] = Array.from({ length: 6 }, (_, i) => ({
  heading: `Heading${i}`,
  explanation: `EXPLAIN${i}`,
  example: `EXAMPLE${i}`,
  check: { kind: "mcq", question: `QUESTION${i}`, options: ["a", `ANSWER${i}`, "c"], correctIndex: 1 },
}));
const plan = buildLessonPlan(false, true, secs);

describe("buildCoachContext", () => {
  it("never includes content from later steps", () => {
    const idx = plan.findIndex((s) => s.phase === "teach" && s.sectionIndex === 2);
    const c = buildCoachContext({ plan, sections: secs, hook: "HOOK", stepIndex: idx });
    expect(c.text).toContain("EXPLAIN2");
    expect(c.text).toContain("EXPLAIN0");
    for (const later of [3, 4, 5]) {
      expect(c.text).not.toContain(`EXPLAIN${later}`);
      expect(c.text).not.toContain(`QUESTION${later}`);
      expect(c.text).not.toContain(`ANSWER${later}`);
    }
    expect(c.coveredTopics).toEqual(["Heading0", "Heading1", "Heading2"]);
  });

  it("reveals earlier answers but not the current check's answer", () => {
    const idx = plan.findIndex((s) => s.phase === "check" && s.sectionIndex === 1);
    const c = buildCoachContext({ plan, sections: secs, stepIndex: idx });
    expect(c.text).toContain("ANSWER0");
    expect(c.text).toContain("QUESTION1");
    expect(c.text).not.toContain("ANSWER1");
    expect(c.stepNumber).toBe(idx + 1);
  });

  it("clamps out-of-range indexes", () => {
    expect(clampIndex(999, 10)).toBe(9);
    expect(clampIndex(-4, 10)).toBe(0);
    expect(clampIndex("x", 10)).toBe(0);
    const c = buildCoachContext({ plan, sections: secs, stepIndex: -5 });
    expect(c.text).not.toContain("EXPLAIN1");
  });
});

describe("sanitizers", () => {
  it("drops invalid plan steps and sections", () => {
    const p = sanitizePlan([{ phase: "teach", sectionIndex: 99 }, { phase: "teach", sectionIndex: 1 }, { phase: "evil" }], 3);
    expect(p).toEqual([{ phase: "teach", sectionIndex: 1 }]);
  });
  it("limits session payload", () => {
    const s = sanitizeSession({ answers: [{ section: 1, correct: false, picked: "x".repeat(500), tries: 99 }, { section: 50, correct: true }], hints: 1e6 }, 3);
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0].picked).toHaveLength(120);
    expect(s.hints).toBe(99);
  });
  it("summarises only covered sections", () => {
    const covered = coveredSectionSet(plan, plan.findIndex((s) => s.phase === "teach" && s.sectionIndex === 1));
    const out = summarizeSession(
      { answers: [{ section: 0, correct: false, picked: "a", tries: 1 }, { section: 4, correct: false, tries: 1 }], hints: 2, revisits: 0 },
      secs,
      covered
    );
    expect(out).toContain("Heading0");
    expect(out).not.toContain("Heading4");
    expect(out).toContain("Hints used: 2");
  });
  it("caps history size", () => {
    const out = summarizeHistory({ weakAreas: ["w".repeat(500)], recentLow: Array(20).fill({ prompt: "p".repeat(500), marks: 0, max: 3 }) });
    expect(out.length).toBeLessThanOrEqual(2400);
  });
});
