import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_MAX_QUESTIONS, selectTopicsForDiagnostic } from "./diagnostic-select";

const mk = (s: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${s}${i}`, name: `${s}${i}`, subject_id: s }));

describe("selectTopicsForDiagnostic", () => {
  it("caps topics*perTopic at the limit and is round-robin, earliest first", () => {
    const { selected, leftover } = selectTopicsForDiagnostic([mk("a", 20), mk("b", 3)], 2);
    expect(selected.length * 2).toBeLessThanOrEqual(DIAGNOSTIC_MAX_QUESTIONS);
    expect(selected.length).toBe(15);
    expect(selected.filter((t) => t.subject_id === "b").length).toBe(3);
    expect(selected.filter((t) => t.subject_id === "a").map((t) => t.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `a${i}`)
    );
    expect(selected.length + leftover.length).toBe(23);
    expect(leftover[0].id).toBe("a12");
  });
  it("takes everything when under the cap", () => {
    const { selected, leftover } = selectTopicsForDiagnostic([mk("a", 2), mk("b", 2)], 2);
    expect(selected.length).toBe(4);
    expect(leftover).toEqual([]);
  });
  it("handles empty input", () => {
    expect(selectTopicsForDiagnostic([], 2)).toEqual({ selected: [], leftover: [] });
  });
});
