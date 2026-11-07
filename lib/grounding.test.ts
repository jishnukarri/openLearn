import { describe, expect, it } from "vitest";
import { keyPointsFromLesson, renderGrounding } from "./grounding";

const lesson = {
  sections: [
    { heading: "What is a hypothesis?", explanation: "A hypothesis is a testable prediction. It says what you expect to happen and why. Scientists then design an experiment to check it.", example: "e", check: { kind: "mcq", question: "q", options: ["a", "SECRETANSWER"], correctIndex: 1 } },
    { heading: "Variables", explanation: "The independent variable is changed; the dependent variable is measured.", example: "e", check: { kind: "mcq", question: "q2", options: ["x"], correctIndex: 0 } },
  ],
} as never;

describe("grounding", () => {
  it("lists what each section taught, without any check answers", () => {
    const points = keyPointsFromLesson(lesson);
    expect(points.map((p) => p.heading)).toEqual(["What is a hypothesis?", "Variables"]);
    expect(JSON.stringify(points)).not.toContain("SECRETANSWER");
  });

  it("puts both the key points and the spec wording in the prompt block", () => {
    const block = renderGrounding({ keyPoints: keyPointsFromLesson(lesson), specExcerpt: "Students should write a testable hypothesis." });
    expect(block).toContain("JUST LEARNED");
    expect(block).toContain("What is a hypothesis?: A hypothesis is a testable prediction.");
    expect(block).toContain("SPECIFICATION WORDING");
    expect(block).toContain("Students should write a testable hypothesis.");
  });

  it("adds nothing when there is nothing to ground on", () => {
    expect(renderGrounding({})).toBe("");
    expect(renderGrounding({ keyPoints: [], specExcerpt: "  " })).toBe("");
    expect(keyPointsFromLesson(null)).toEqual([]);
  });
});
