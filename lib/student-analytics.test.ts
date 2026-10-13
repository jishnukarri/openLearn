import { describe, expect, it } from "vitest";
import { attentionReasons, averageScore, bucketActivity, daysSince, latestTimestamp } from "./student-analytics";

const now = new Date("2026-10-13T12:00:00Z");

describe("student analytics helpers", () => {
  it("counts whole days since a timestamp", () => {
    expect(daysSince("2026-10-10T12:00:00Z", now)).toBe(3);
    expect(daysSince(null, now)).toBeNull();
  });

  it("picks the latest timestamp and ignores blanks", () => {
    expect(latestTimestamp([null, "2026-10-01T00:00:00Z", undefined, "2026-10-05T00:00:00Z"])).toBe("2026-10-05T00:00:00Z");
    expect(latestTimestamp([null])).toBeNull();
  });

  it("averages scores", () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([0.2, 0.6])).toBeCloseTo(0.4);
  });

  it("flags inactive, struggling and unstarted students", () => {
    expect(attentionReasons({ lastActive: null, avgScore: null, now })).toEqual(["never-started"]);
    expect(attentionReasons({ lastActive: "2026-10-01T00:00:00Z", avgScore: 0.4, now })).toEqual(["inactive", "low-mastery"]);
    expect(attentionReasons({ lastActive: "2026-10-12T00:00:00Z", avgScore: 0.8, now })).toEqual([]);
  });

  it("buckets answers per day, oldest first", () => {
    const pts = bucketActivity(
      [
        { created_at: "2026-10-13T09:00:00Z", marks_awarded: 2, max_marks: 4 },
        { created_at: "2026-10-13T10:00:00Z", marks_awarded: 4, max_marks: 4 },
        { created_at: "2026-01-01T00:00:00Z", marks_awarded: 1, max_marks: 1 },
      ],
      3,
      now
    );
    expect(pts.map((p) => p.day)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(pts[2]).toEqual({ day: "2026-10-13", attempts: 2, percent: 75 });
    expect(pts[0].percent).toBeNull();
  });
});
