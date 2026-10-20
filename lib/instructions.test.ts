import { describe, it, expect } from "vitest";
import { composeInstructions } from "./instructions";

describe("composeInstructions", () => {
  it("returns undefined when nothing is set", () => {
    expect(composeInstructions(null, "  ", "")).toBeUndefined();
  });
  it("puts the subject note before the topic note", () => {
    const out = composeInstructions("Use metric", "Add a diagram", "")!;
    expect(out.indexOf("Use metric")).toBeLessThan(out.indexOf("Add a diagram"));
  });
  it("works with only a topic note", () => {
    expect(composeInstructions(undefined, "Add a diagram", "")).toBe("Add a diagram");
  });
  it("appends reference material last", () => {
    const out = composeInstructions("S", "T", "\n\nREF")!;
    expect(out.endsWith("\n\nREF")).toBe(true);
  });
});
