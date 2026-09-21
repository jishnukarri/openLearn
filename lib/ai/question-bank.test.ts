import { describe, it, expect } from "vitest";
import { distributeQuestions } from "../question-distribute";

describe("distributeQuestions", () => {
  it("3 sections → [3, 3, 4]", () => {
    expect(distributeQuestions(3, 10)).toEqual([3, 3, 4]);
  });
  it("4 sections → [2, 2, 3, 3]", () => {
    expect(distributeQuestions(4, 10)).toEqual([2, 2, 3, 3]);
  });
  it("5 sections → [2, 2, 2, 2, 2]", () => {
    expect(distributeQuestions(5, 10)).toEqual([2, 2, 2, 2, 2]);
  });
  it("2 sections → [5, 5]", () => {
    expect(distributeQuestions(2, 10)).toEqual([5, 5]);
  });
  it("1 section → [10]", () => {
    expect(distributeQuestions(1, 10)).toEqual([10]);
  });
});
