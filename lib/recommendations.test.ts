import { describe, expect, it } from "vitest";
import { rankTopics, scoreKey, type RankableTopic } from "./recommendations";

const t = (id: string, name: string, subjectId: string): RankableTopic => ({
  id,
  name,
  subjectId,
  subjectName: subjectId.toUpperCase(),
});

const topics = [
  t("cs1", "Algorithms", "cs"),
  t("cs2", "Binary", "cs"),
  t("ph1", "Energy", "ph"),
  t("ph2", "Power", "ph"),
  t("ch1", "Atoms", "ch"),
];

describe("rankTopics", () => {
  it("leads with weak topics from every subject, not just the first subject", () => {
    const scores = new Map([
      [scoreKey("cs", "Algorithms"), 0.9],
      [scoreKey("cs", "Binary"), 0.5],
      [scoreKey("ph", "Energy"), 0.4],
      [scoreKey("ch", "Atoms"), 0.55],
    ]);
    const ids = rankTopics(topics, scores, new Set()).map((r) => r.id);
    expect(ids.slice(0, 3).sort()).toEqual(["ch1", "cs2", "ph1"]);
  });

  it("puts strong topics last and skips completed ones", () => {
    const scores = new Map([[scoreKey("cs", "Algorithms"), 0.95]]);
    const ranked = rankTopics(topics, scores, new Set(["ph2"]));
    expect(ranked.map((r) => r.id)).not.toContain("ph2");
    expect(ranked.at(-1)?.id).toBe("cs1");
  });

  it("falls back to syllabus order with no results, alternating subjects", () => {
    const ids = rankTopics(topics, new Map(), new Set()).map((r) => r.id);
    expect(ids).toEqual(["cs1", "ph1", "ch1", "cs2", "ph2"]);
  });
});
