import { describe, expect, it } from "vitest";
import { refreshStaleExamples } from "./lesson-edit";
import type { LessonContent } from "@/lib/ai/lessons";

const check = { question: "q", options: ["a", "b"], correctIndex: 0 };
const scene = { captions: ["a"], elements: [] } as never;
const mk = (example: string, heading = "H"): LessonContent => ({
  sections: [
    { heading, explanation: "E", example, exampleScene: scene, exampleSteps: ["old"], check },
    { heading: "Two", explanation: "E", example: "same", exampleScene: scene, exampleSteps: ["keep"], check },
  ],
});

describe("refreshStaleExamples", () => {
  it("clears and re-derives only changed sections", () => {
    const { content, changed } = refreshStaleExamples(mk("old text"), mk("First line.\nSecond line."));
    expect(changed).toEqual([0]);
    expect(content.sections[0].exampleScene).toBeNull();
    expect(content.sections[0].exampleSteps).toEqual(["First line.", "Second line."]);
    expect(content.sections[1].exampleScene).toBe(scene);
    expect(content.sections[1].exampleSteps).toEqual(["keep"]);
  });
  it("ignores whitespace-only edits and treats heading changes as stale", () => {
    expect(refreshStaleExamples(mk("x"), mk("x  ")).changed).toEqual([]);
    expect(refreshStaleExamples(mk("x"), mk("x", "New")).changed).toEqual([0]);
  });
  it("does nothing without a stored lesson", () => {
    expect(refreshStaleExamples(null, mk("x")).changed).toEqual([]);
  });
});
