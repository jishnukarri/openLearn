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
