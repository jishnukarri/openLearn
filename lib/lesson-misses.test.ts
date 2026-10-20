import { describe, expect, it } from "vitest";
import { checkAnswerText, missNote, previousTopicIds, rankLessonMisses, type LessonMiss } from "./lesson-misses";

const m = (id: string, topicId: string, over: Partial<LessonMiss> = {}): LessonMiss => ({
  id, topicId, subtopicId: null, prompt: id, correctAnswer: "a", missedCount: 1,
  lastMissedAt: "2026-10-01T00:00:00Z", resolved: false, lessonLabel: `L-${topicId}`, ...over,
});

describe("rankLessonMisses", () => {
  it("prefers this topic, then nearest previous, drops resolved and unrelated", () => {
    const out = rankLessonMisses(
      [m("far", "t0"), m("prev", "t1"), m("cur", "t2"), m("done", "t2", { resolved: true }), m("other", "x")],
      { topicId: "t2", previousTopicIds: ["t1", "t0"], limit: 5 }
    );
    expect(out.map((x) => x.id)).toEqual(["cur", "prev", "far"]);
  });
  it("orders by missed count then recency within a topic", () => {
    const out = rankLessonMisses(
      [m("a", "t", { missedCount: 1 }), m("b", "t", { missedCount: 3 }), m("c", "t", { missedCount: 1, lastMissedAt: "2026-10-05T00:00:00Z" })],
      { topicId: "t", previousTopicIds: [] }
    );
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("respects the limit", () => {
    expect(rankLessonMisses([m("a", "t"), m("b", "t")], { topicId: "t", previousTopicIds: [], limit: 1 })).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("finds earlier topics by position, nearest first", () => {
    expect(previousTopicIds([{ id: "a", position: 1 }, { id: "b", position: 2 }, { id: "c", position: 3 }, { id: "d", position: 4 }], 4)).toEqual(["c", "b"]);
  });
  it("renders answers for each check kind", () => {
    expect(checkAnswerText({ question: "q", options: ["x", "y"], correctIndex: 1 })).toBe("y");
    expect(checkAnswerText({ kind: "multi", question: "q", options: ["x", "y", "z"], correctIndexes: [0, 2] })).toBe("x; z");
    expect(checkAnswerText({ kind: "short", question: "q", accepted: ["cell"] })).toBe("cell");
    expect(checkAnswerText({ kind: "matching", question: "q", pairs: [{ left: "a", right: "b" }] })).toBe("a = b");
  });
  it("names the lesson in the note", () => {
    expect(missNote({ lessonLabel: "Cells" })).toBe("You found this tricky in Cells — try it again");
  });
});
