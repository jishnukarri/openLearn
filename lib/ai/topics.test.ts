import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ chatJson: vi.fn() }));
import { normalizeTopics } from "./topics";

describe("normalizeTopics", () => {
  it("fills in what a cut-off reply left out instead of crashing", () => {
    const out = normalizeTopics([
      { name: "Forces", summary: "Pushes and pulls", subtopics: ["Newton's laws", "  "] },
      { name: "Waves" }, // the last topic of a truncated answer
    ]);
    expect(out).toEqual([
      { name: "Forces", summary: "Pushes and pulls", subtopics: ["Newton's laws"] },
      { name: "Waves", summary: "", subtopics: [] },
    ]);
  });

  it("drops entries with no name and tolerates junk", () => {
    expect(normalizeTopics([{ summary: "x" }, null, "nope", { name: "  " }])).toEqual([]);
    expect(normalizeTopics(undefined)).toEqual([]);
    expect(normalizeTopics({ topics: [] })).toEqual([]);
  });
});
