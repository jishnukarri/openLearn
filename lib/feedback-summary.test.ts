import { describe, expect, it } from "vitest";
import { shortReason } from "./feedback-summary";

describe("shortReason", () => {
  it("returns empty for empty input", () => {
    expect(shortReason("  ")).toBe("");
  });
  it("keeps short text whole and strips markdown marks", () => {
    expect(shortReason("A **cache** stores data.")).toBe("A cache stores data.");
  });
  it("stops at a sentence boundary under the limit", () => {
    const t = "First sentence here. Second sentence is also here. " + "x".repeat(200) + ".";
    expect(shortReason(t, 60)).toBe("First sentence here. Second sentence is also here.");
  });
  it("never exceeds the limit", () => {
    const t = "word ".repeat(100);
    const r = shortReason(t, 140);
    expect(r.length).toBeLessThanOrEqual(140);
    expect(r.endsWith("…")).toBe(true);
  });
  it("does not split on decimals or abbreviations without a space", () => {
    expect(shortReason("Version 3.5 is fast. Next.", 140)).toBe("Version 3.5 is fast. Next.");
  });
});

describe("shortReason with maths and underscores", () => {
  it("flattens inline math instead of showing raw $ and commands", () => {
    expect(shortReason("Use $\\frac{a}{b}$ and $3 \\times 4$ here.")).toBe("Use a/b and 3 × 4 here.");
  });
  it("keeps underscores inside identifiers and subscripts", () => {
    expect(shortReason("Set max_value to $x_1$.")).toBe("Set max_value to x_1.");
  });
  it("strips emphasis underscores", () => {
    expect(shortReason("This is _really_ key.")).toBe("This is really key.");
  });
  it("does not cut inside a math span", () => {
    const r = shortReason("Because $\\frac{1}{2}$ " + "word ".repeat(60), 40);
    expect(r).not.toMatch(/[$\\]/);
  });
});
