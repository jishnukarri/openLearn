import { describe, expect, it } from "vitest";
import { autoMark, answersMatch, payloadToText } from "./question-marking";
import type { QuestionFormat } from "./ai/questions";

describe("answersMatch", () => {
  it("normalizes case, whitespace and trailing punctuation", () => {
    expect(answersMatch("  Photosynthesis. ", "photosynthesis")).toBe(true);
  });
  it("compares numbers numerically", () => {
    expect(answersMatch("0.50", "0.5")).toBe(true);
    expect(answersMatch("1,000", "1000")).toBe(true);
    expect(answersMatch("12", "13")).toBe(false);
  });
  it("expands common abbreviations", () => {
    expect(answersMatch("no. of protons", "number of protons")).toBe(true);
    expect(answersMatch("number of protons", "no. of protons")).toBe(true);
    expect(answersMatch("approx. 10", "approximately 10")).toBe(true);
    expect(answersMatch("max. temp.", "maximum temperature")).toBe(true);
  });
  it("fuzzy: accepts minor spelling errors in longer words", () => {
    expect(answersMatch("photosinthesis", "photosynthesis")).toBe(true); // 1 edit in 14
    expect(answersMatch("mitocondria", "mitochondria")).toBe(true);      // 1 edit in 12
    expect(answersMatch("oxidise", "oxidize")).toBe(true);               // UK/US 1 edit
    expect(answersMatch("diffusion", "confusion")).toBe(false);          // 3 edits — too far
    expect(answersMatch("cat", "bat")).toBe(false);                      // short — no fuzzy
  });
  it("normalizes simple math symbols and spacing", () => {
    expect(answersMatch("4^3 + \\sqrt{25}", "4^3+sqrt{25}")).toBe(true);
    expect(answersMatch("3/10", "\\frac{3}{10}")).toBe(true);
  });
});

describe("autoMark", () => {
  const mcq: QuestionFormat = {
    type: "multiple-choice",
    options: ["A", "B", "C", "D"],
    correctIndexes: [1, 3],
  };
  it("multi-select must match exactly", () => {
    expect(autoMark(mcq, { selected: [1, 3] }, 2)?.marksAwarded).toBe(2);
    expect(autoMark(mcq, { selected: [1] }, 2)?.marksAwarded).toBe(0);
    expect(autoMark(mcq, { selected: [1, 2, 3] }, 2)?.marksAwarded).toBe(0);
  });

  const matching: QuestionFormat = {
    type: "matching",
    pairs: [
      { left: "Period", right: "Horizontal row" },
      { left: "Group", right: "Vertical column" },
      { left: "Period number", right: "Number of electron shells" },
      { left: "Group number", right: "Number of outer shell electrons" },
    ],
  };
  it("matching awards proportional marks with per-pair feedback", () => {
    const half = autoMark(matching, { matches: [0, 1, 3, 2] }, 4);
    expect(half?.marksAwarded).toBe(2);
    expect(half?.feedback).toHaveLength(4);
    expect(half?.feedback[0].met).toBe(true);
    expect(half?.feedback[2].met).toBe(false);
    expect(autoMark(matching, { matches: [0, 1, 2, 3] }, 4)?.marksAwarded).toBe(4);
  });

  const short: QuestionFormat = { type: "short-answer", accepted: ["mitochondria", "mitochondrion"] };
  it("short answer: match scores, near-miss defers to AI (null)", () => {
    expect(autoMark(short, { text: "Mitochondrion" }, 1)?.marksAwarded).toBe(1);
    expect(autoMark(short, { text: "the powerhouse" }, 1)).toBeNull();
    expect(autoMark(short, { text: "" }, 1)?.marksAwarded).toBe(0);
  });

  const calc: QuestionFormat = { type: "calculation", answer: "9.8", unit: "m/s²" };
  it("calculation: right answer = full marks, wrong defers to AI", () => {
    expect(autoMark(calc, { text: "9.80" }, 3)?.marksAwarded).toBe(3);
    expect(autoMark(calc, { text: "12" }, 3)).toBeNull();
  });

  const fractionCalc: QuestionFormat = {
    type: "calculation",
    answer: "3/10",
    answerFormat: "fraction",
  };
  it("calculation fractions accept simplified slash syntax", () => {
    expect(autoMark(fractionCalc, { text: "3/10" }, 2)?.marksAwarded).toBe(2);
    expect(autoMark(fractionCalc, { text: "\\frac{3}{10}" }, 2)?.marksAwarded).toBe(2);
    expect(autoMark(fractionCalc, { text: "0.3" }, 2)?.marksAwarded).toBe(2);
  });

  it("prose formats defer to AI", () => {
    expect(autoMark({ type: "extended" }, { text: "essay" }, 6)).toBeNull();
    expect(autoMark({ type: "practical" }, { text: "plan" }, 6)).toBeNull();
  });
});

describe("payloadToText", () => {
  it("renders matching picks readably", () => {
    const format: QuestionFormat = {
      type: "matching",
      pairs: [
        { left: "Group", right: "Vertical column" },
        { left: "Period", right: "Horizontal row" },
      ],
    };
    expect(payloadToText(format, { matches: [1, 0] })).toBe(
      "Group → Horizontal row\nPeriod → Vertical column"
    );
  });
  it("renders structured parts with labels", () => {
    const format: QuestionFormat = {
      type: "structured",
      parts: [
        { label: "a", prompt: "p1", marks: 2, markscheme: [] },
        { label: "b", prompt: "p2", marks: 3, markscheme: [] },
      ],
    };
    expect(payloadToText(format, { parts: ["one", "two"] })).toBe(
      "(a) one\n\n(b) two"
    );
  });
  it("renders step-by-step calculation working", () => {
    const format: QuestionFormat = {
      type: "calculation",
      answer: "69",
    };
    expect(
      payloadToText(format, {
        text: "69",
        workingSteps: ["4^3 = 64", "sqrt(25) = 5", "64 + 5 = 69"],
      })
    ).toContain("1. 4^3 = 64");
  });
});
