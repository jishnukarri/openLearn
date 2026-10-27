import { describe, expect, it } from "vitest";
import { answerSignature, hasAnswer, submitLocked, type AnswerParts } from "./answer-signature";

const blank: AnswerParts = { selected: [], text: "", workingSteps: ["", "", ""], matches: {}, parts: {}, imagePaths: [] };

describe("submit lock", () => {
  it("is locked with no answer, including spaces only", () => {
    expect(submitLocked(blank, null)).toBe(true);
    expect(submitLocked({ ...blank, text: "   \n  " }, null)).toBe(true);
    expect(hasAnswer({ ...blank, parts: { 0: "  ", 1: "" } })).toBe(false);
  });

  it("opens once there is a real answer", () => {
    expect(submitLocked({ ...blank, text: "osmosis" }, null)).toBe(false);
    expect(submitLocked({ ...blank, selected: [2] }, null)).toBe(false);
    expect(submitLocked({ ...blank, matches: { 0: 1 } }, null)).toBe(false);
    expect(submitLocked({ ...blank, imagePaths: ["a.png"] }, null)).toBe(false);
  });

  it("stays locked after feedback until the answer changes", () => {
    const a = { ...blank, text: "diffusion" };
    const sig = answerSignature(a);
    expect(submitLocked(a, sig)).toBe(true);
    expect(submitLocked({ ...a, text: "  diffusion  " }, sig)).toBe(true); // spaces don't count
    expect(submitLocked({ ...a, text: "Diffusion." }, sig)).toBe(true); // case/punctuation don't count
    expect(submitLocked({ ...a, text: "osmosis" }, sig)).toBe(false);
  });

  it("treats a different multiple-choice pick as a change, in any order", () => {
    const sig = answerSignature({ ...blank, selected: [1, 3] });
    expect(submitLocked({ ...blank, selected: [3, 1] }, sig)).toBe(true);
    expect(submitLocked({ ...blank, selected: [1] }, sig)).toBe(false);
  });
});
