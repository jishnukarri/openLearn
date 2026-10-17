import { describe, expect, it } from "vitest";
import { dayLabel, groupByDay, matchesFilter, mergeEvents, paginate, parseFilter, truncateSnippet, type ActivityEvent } from "./student-activity";

const ev = (id: string, at: string, kind: ActivityEvent["kind"] = "answer"): ActivityEvent => ({ id, at, kind, text: id });
const now = new Date("2026-10-17T12:00:00Z");

describe("student activity helpers", () => {
  it("merges newest first and drops duplicate ids", () => {
    const out = mergeEvents(
      [ev("a", "2026-10-01T10:00:00Z"), ev("b", "2026-10-03T10:00:00Z")],
      [ev("c", "2026-10-02T10:00:00Z"), ev("a", "2026-10-01T10:00:00Z")],
    );
    expect(out.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("paginates with a cursor only when more remain", () => {
    const list = mergeEvents([ev("a", "2026-10-01T00:00:00Z"), ev("b", "2026-10-02T00:00:00Z"), ev("c", "2026-10-03T00:00:00Z")]);
    expect(paginate(list, 3).nextBefore).toBeNull();
    const p = paginate(list, 2);
    expect(p.events).toHaveLength(2);
    expect(p.nextBefore).toBe("2026-10-02T00:00:00Z");
  });

  it("labels days", () => {
    expect(dayLabel("2026-10-17T01:00:00Z", now)).toBe("Today");
    expect(dayLabel("2026-10-16T23:00:00Z", now)).toBe("Yesterday");
    expect(dayLabel("2026-10-12T09:00:00Z", now)).toBe("12 Oct 2026");
  });

  it("groups consecutive events by day", () => {
    const g = groupByDay([ev("a", "2026-10-17T09:00:00Z"), ev("b", "2026-10-17T08:00:00Z"), ev("c", "2026-10-12T08:00:00Z")], now);
    expect(g.map((x) => [x.label, x.events.length])).toEqual([["Today", 2], ["12 Oct 2026", 1]]);
  });

  it("truncates snippets to 120 chars", () => {
    expect(truncateSnippet("x".repeat(300))).toHaveLength(120);
    expect(truncateSnippet("  a   b ")).toBe("a b");
    expect(truncateSnippet(null)).toBe("");
  });

  it("filters by kind and parses the filter param", () => {
    expect(matchesFilter("lesson", "lessons")).toBe(true);
    expect(matchesFilter("answer", "lessons")).toBe(false);
    expect(matchesFilter("account", "all")).toBe(true);
    expect(parseFilter("bogus")).toBe("all");
    expect(parseFilter(["practice"])).toBe("practice");
  });
});

import { normaliseFeedback } from "./student-activity";

describe("normaliseFeedback", () => {
  it("turns marking objects, JSON strings and plain text into lines", () => {
    expect(normaliseFeedback([{ point: "Defines X", met: true, comment: "Well done" }])).toEqual([
      { met: true, point: "Defines X", comment: "Well done" },
    ]);
    expect(normaliseFeedback('[{"point":"p","met":false,"comment":"c"}]')[0].met).toBe(false);
    expect(normaliseFeedback("Good effort")).toEqual([{ met: null, point: null, comment: "Good effort" }]);
    expect(normaliseFeedback(null)).toEqual([]);
  });
});
