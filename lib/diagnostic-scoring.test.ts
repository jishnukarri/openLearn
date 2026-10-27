import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { sanitiseLevelPayload, scoreDiagnosticAnswerInstant } from "./diagnostic-scoring";
import type { DiagnosticQuestion } from "@/lib/supabase/diagnostic";

const fill = (blankAnswer: string, extra = {}) =>
  ({ type: "fill_blank", content: { blankAnswer, ...extra } }) as unknown as DiagnosticQuestion;

describe("diagnostic scoring edge cases", () => {
  it("sanitises hostile payloads", () => {
    expect(sanitiseLevelPayload(null)).toBeNull();
    expect(sanitiseLevelPayload([])).toBeNull();
    expect(sanitiseLevelPayload({ blankText: 5, mcqIndex: "1", shortAnswer: "x".repeat(9000) })).toEqual({
      shortAnswer: "x".repeat(2000),
    });
  });
  it("empty text never scores on a blank", () => {
    expect(scoreDiagnosticAnswerInstant(fill(""), { blankText: "" })).toBe(0);
    expect(scoreDiagnosticAnswerInstant(fill("osmosis"), { blankText: "osmosis" })).toBe(1);
  });
  it("does not crash on a non-string blank", () => {
    expect(scoreDiagnosticAnswerInstant(fill("5", { numeric: true }), { blankText: 5 as unknown as string })).toBe(0);
  });
});
