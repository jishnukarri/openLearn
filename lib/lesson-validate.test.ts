import { describe, expect, it } from "vitest";
import { validateLesson, splitAccepted, sectionIndexOfPath } from "./lesson-validate";

const sec = (check: unknown, over: Record<string, unknown> = {}) => ({
  heading: "H", explanation: "E", example: "X", check, ...over,
});
const lesson = (...sections: unknown[]) => ({ sections });
const mcq = { question: "Q?", options: ["a", "b"], correctIndex: 1 };
const paths = (c: unknown) => validateLesson(c).map((i) => i.path);

describe("validateLesson", () => {
  it("accepts valid lessons of every kind", () => {
    expect(validateLesson(lesson(
      sec(mcq),
      sec({ kind: "mcq", ...mcq }),
      sec({ kind: "multi", question: "Q", options: ["a", "b", "c"], correctIndexes: [0, 2] }),
      sec({ kind: "short", question: "Q", accepted: ["x"] }),
      sec({ kind: "matching", question: "Q", pairs: [{ left: "a", right: "b" }, { left: "c", right: "d" }] }),
    ))).toEqual([]);
  });
  it("rejects empty lesson / missing sections", () => {
    expect(validateLesson(null)).toHaveLength(1);
    expect(validateLesson({ sections: [] })).toHaveLength(1);
  });
  it("requires heading, explanation, example", () => {
    expect(paths(lesson(sec(mcq, { heading: " ", explanation: "", example: undefined }))))
      .toEqual(["sections.0.heading", "sections.0.explanation", "sections.0.example"]);
  });
  it("requires a check and question", () => {
    expect(paths(lesson(sec(undefined)))).toEqual(["sections.0.check"]);
    expect(paths(lesson(sec({ ...mcq, question: " " })))).toEqual(["sections.0.check.question"]);
  });
  it("mcq: min options, blanks, duplicates, index range", () => {
    expect(paths(lesson(sec({ ...mcq, options: ["a"] })))).toContain("sections.0.check.options");
    expect(paths(lesson(sec({ ...mcq, options: ["a", " "] })))).toContain("sections.0.check.options.1");
    expect(paths(lesson(sec({ ...mcq, options: ["Yes", " yes "] })))).toContain("sections.0.check.options.1");
    expect(paths(lesson(sec({ ...mcq, correctIndex: 2 })))).toContain("sections.0.check.correctIndex");
    expect(paths(lesson(sec({ ...mcq, correctIndex: -1 })))).toContain("sections.0.check.correctIndex");
    expect(paths(lesson(sec({ ...mcq, correctIndex: undefined })))).toContain("sections.0.check.correctIndex");
  });
  it("multi: needs non-empty in-range indexes", () => {
    const m = { kind: "multi", question: "Q", options: ["a", "b"], correctIndexes: [] as number[] };
    expect(paths(lesson(sec(m)))).toEqual(["sections.0.check.correctIndexes"]);
    expect(paths(lesson(sec({ ...m, correctIndexes: [5] })))).toEqual(["sections.0.check.correctIndexes"]);
    expect(paths(lesson(sec({ ...m, correctIndexes: [1] })))).toEqual([]);
  });
  it("short: needs an accepted answer", () => {
    const s = { kind: "short", question: "Q", accepted: [] as string[] };
    expect(paths(lesson(sec(s)))).toEqual(["sections.0.check.accepted"]);
    expect(paths(lesson(sec({ ...s, accepted: [" ", ""] })))).toEqual(["sections.0.check.accepted"]);
    expect(paths(lesson(sec({ ...s, accepted: [" 4 "] })))).toEqual([]);
  });
  it("matching: needs 2 pairs with both sides", () => {
    const m = { kind: "matching", question: "Q", pairs: [{ left: "a", right: "b" }] };
    expect(paths(lesson(sec(m)))).toEqual(["sections.0.check.pairs"]);
    expect(paths(lesson(sec({ ...m, pairs: [{ left: "a", right: "" }, { left: " ", right: "d" }] }))))
      .toEqual(["sections.0.check.pairs.0.right", "sections.0.check.pairs.1.left"]);
  });
  it("reports the right section and plain messages", () => {
    const issues = validateLesson(lesson(sec(mcq), sec(mcq, { heading: "" })));
    expect(issues).toEqual([{ path: "sections.1.heading", message: "Section 2: add a heading." }]);
    expect(sectionIndexOfPath(issues[0].path)).toBe(1);
  });
  it("splitAccepted splits on commas and newlines", () => {
    expect(splitAccepted("a, b\n c ,,")).toEqual(["a", "b", "c"]);
  });
});
