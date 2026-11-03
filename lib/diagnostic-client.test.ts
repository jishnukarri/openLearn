import { describe, expect, it } from "vitest";
import { toClientDiagnosticQuestion } from "./diagnostic-client";
import type { DiagnosticQuestion } from "./supabase/diagnostic";

const match = (id: string): DiagnosticQuestion =>
  ({
    id,
    session_id: "s",
    subject_id: "sub",
    topic_name: "Energy",
    prompt: "Match them",
    position: 0,
    type: "match",
    max_marks: 3,
    content: { pairs: ["a", "b", "c", "d", "e"].map((x) => ({ left: `L${x}`, right: `R${x}` })) },
  }) as unknown as DiagnosticQuestion;

describe("toClientDiagnosticQuestion", () => {
  it("shows a matching question's right-hand items in the same order every time", () => {
    const first = toClientDiagnosticQuestion(match("q-1"));
    const second = toClientDiagnosticQuestion(match("q-1"));
    expect(first.type === "match" && second.type === "match" && first.rights).toEqual(second.type === "match" ? second.rights : null);
  });

  it("keeps every pair index, so the answer key still lines up", () => {
    const q = toClientDiagnosticQuestion(match("q-2"));
    if (q.type !== "match") throw new Error("expected a match question");
    expect(q.rights.map((r) => r.index).sort()).toEqual([0, 1, 2, 3, 4]);
    for (const r of q.rights) expect(r.label).toBe(`R${"abcde"[r.index]}`);
  });

  it("reads a numeric question stored as fill_blank as numeric", () => {
    const q = toClientDiagnosticQuestion({
      id: "n", session_id: "s", subject_id: "x", topic_name: "T", prompt: "How many?", position: 0,
      type: "fill_blank", max_marks: 1, content: { numeric: { unit: "mol" } },
    } as unknown as DiagnosticQuestion);
    expect(q.type).toBe("numeric");
  });
});
