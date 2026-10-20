import { describe, expect, it } from "vitest";
import { missCounts, rankPractice, type PracticeCandidate } from "./lesson-personalise";

const q = (id: string, subtopicId: string | null = null): PracticeCandidate => ({
  id, prompt: `Prompt ${id}`, modelAnswer: "A", points: ["p"], maxMarks: 2, subtopicId,
});
const base = { studentId: "s1", topicLabel: "Forces", attempts: [] as { questionId: string; correct: boolean }[] };

describe("missCounts", () => {
  it("counts low marks and wrong attempts, not full marks", () => {
    const m = missCounts(
      [{ questionId: "a", marksAwarded: 1, maxMarks: 2 }, { questionId: "b", marksAwarded: 2, maxMarks: 2 }],
      [{ questionId: "a", correct: false }, { questionId: "c", correct: true }]
    );
    expect(m.get("a")).toBe(2);
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(false);
  });
});

describe("rankPractice", () => {
  it("returns null with no history so the default activity is used", () => {
    expect(rankPractice({ ...base, candidates: [q("a")], answers: [] })).toBeNull();
  });
  it("puts the most-missed first and caps at three", () => {
    const r = rankPractice({
      ...base,
      candidates: [q("a"), q("b"), q("c"), q("d"), q("e")],
      answers: [
        { questionId: "c", marksAwarded: 0, maxMarks: 2 },
        { questionId: "c", marksAwarded: 1, maxMarks: 2 },
        { questionId: "a", marksAwarded: 1, maxMarks: 2 },
        { questionId: "b", marksAwarded: 0, maxMarks: 2 },
        { questionId: "d", marksAwarded: 2, maxMarks: 2 },
        { questionId: "e", marksAwarded: 0, maxMarks: 2 },
      ],
    })!;
    expect(r.items.map((i) => i.id)[0]).toBe("c");
    expect(r.items).toHaveLength(3);
    expect(r.items.some((i) => i.id === "d")).toBe(false);
  });
  it("prefers the current subtopic and names it in the reason", () => {
    const r = rankPractice({
      ...base,
      subtopicId: "s",
      subtopicLabel: "Friction",
      candidates: [q("a"), q("b", "s")],
      answers: [{ questionId: "a", marksAwarded: 0, maxMarks: 2 }, { questionId: "b", marksAwarded: 0, maxMarks: 2 }],
    })!;
    expect(r.items[0].id).toBe("b");
    expect(r.reason).toBe("Picked because you found Friction tricky last time.");
  });
  it("mentions weaker area only when mastery is low", () => {
    const args = { ...base, candidates: [q("a")], answers: [{ questionId: "a", marksAwarded: 0, maxMarks: 2 }] };
    expect(rankPractice({ ...args, mastery: 0.3 })!.reason).toContain("weaker areas");
    expect(rankPractice({ ...args, mastery: 0.9 })!.reason).not.toContain("weaker");
  });
  it("breaks ties differently per student but is stable for one student", () => {
    const cands = Array.from({ length: 8 }, (_, i) => q(`q${i}`));
    const answers = cands.map((c) => ({ questionId: c.id, marksAwarded: 0, maxMarks: 2 }));
    const run = (studentId: string) => rankPractice({ ...base, studentId, candidates: cands, answers })!.items.map((i) => i.id).join();
    expect(run("s1")).toBe(run("s1"));
    expect(run("s1")).not.toBe(run("s2"));
  });
});

describe("rankPractice with lesson misses", () => {
  const miss = { id: "m1", topicId: "t", subtopicId: null, prompt: "What is X?", correctAnswer: "Y", missedCount: 2, lastMissedAt: "2026-10-01T00:00:00Z", resolved: false, lessonLabel: "Cells" };
  it("puts carried misses first with a true note, even with no bank history", () => {
    const r = rankPractice({ studentId: "s1", candidates: [], answers: [], attempts: [], topicLabel: "Forces", lessonMisses: [miss] });
    expect(r?.items[0].note).toBe("You found this tricky in Cells — try it again");
    expect(r?.items[0].missId).toBe("m1");
  });
  it("is unchanged without misses", () => {
    expect(rankPractice({ studentId: "s1", candidates: [], answers: [], attempts: [], topicLabel: "Forces" })).toBeNull();
  });
});
