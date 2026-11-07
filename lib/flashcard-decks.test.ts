import { describe, expect, it } from "vitest";
import {
  MAX_PERSONAL_DECKS,
  avoidFronts,
  cardRows,
  copyTitle,
  decksToArchive,
  isShareToken,
  newShareToken,
  pickDeck,
  remedialBlock,
  remedialEligible,
  variationBlock,
} from "./flashcard-decks";

describe("decksToArchive", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, createdAt: `2026-11-0${i + 1}` }));
  it("keeps room for one more, retiring the oldest", () => {
    expect(decksToArchive(mk(2))).toEqual([]);
    expect(decksToArchive(mk(3))).toEqual(["d0"]);
    expect(decksToArchive(mk(5))).toEqual(["d0", "d1", "d2"]);
  });
  it("does not depend on the order it is given", () => {
    expect(decksToArchive([...mk(3)].reverse())).toEqual(["d0"]);
  });
  it("limit is three", () => expect(MAX_PERSONAL_DECKS).toBe(3));
});

describe("remedialEligible", () => {
  it("needs two or more unresolved misses", () => {
    expect(remedialEligible(0)).toBe(false);
    expect(remedialEligible(1)).toBe(false);
    expect(remedialEligible(2)).toBe(true);
  });
});

describe("cardRows", () => {
  it("numbers the cards from zero and drops weak ones", () => {
    const rows = cardRows("deck1", [
      { front: "What is a hypothesis?", back: "A testable prediction about what will happen." },
      { front: "", back: "no front" },
      { front: "Independent variable", back: "The variable the investigator changes." },
    ]);
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i));
    expect(rows.every((r) => r.deck_id === "deck1")).toBe(true);
    expect(rows.some((r) => r.front === "")).toBe(false);
  });
});

describe("share tokens", () => {
  it("are unguessable, unique and recognisable", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).not.toBe(b);
    expect(isShareToken(a)).toBe(true);
    expect(isShareToken("short")).toBe(false);
    expect(isShareToken("../../etc/passwd")).toBe(false);
    expect(isShareToken(undefined)).toBe(false);
  });
});

type D = { id: string; archivedAt: string | null; ownerId: string | null };
describe("pickDeck", () => {
  const standard: D = { id: "std", archivedAt: null, ownerId: null };
  it("uses the student's own choice when it is live and theirs", () => {
    const mine: D = { id: "mine", archivedAt: null, ownerId: "s1" };
    expect(pickDeck({ studentId: "s1", chosen: mine, standard })?.id).toBe("mine");
  });
  it("falls back to the standard deck for an archived, missing or someone else's deck", () => {
    expect(pickDeck({ studentId: "s1", chosen: { id: "old", archivedAt: "x", ownerId: "s1" } as D, standard })?.id).toBe("std");
    expect(pickDeck({ studentId: "s1", chosen: { id: "theirs", archivedAt: null, ownerId: "s2" } as D, standard })?.id).toBe("std");
    expect(pickDeck<D>({ studentId: "s1", chosen: null, standard })?.id).toBe("std");
    expect(pickDeck<D>({ studentId: "s1", chosen: null, standard: null })).toBeNull();
  });
});

describe("small helpers", () => {
  it("titles a copy and lists fronts to avoid", () => {
    expect(copyTitle("My waves deck")).toBe("My waves deck (shared)");
    expect(copyTitle(null)).toBe("Shared deck");
    expect(avoidFronts([{ front: "a", back: "b" }, { front: "c", back: "d" }])).toEqual(["a", "c"]);
  });
});

describe("prompt blocks for non-standard decks", () => {
  it("asks a personal deck to avoid the cards already in the standard one", () => {
    const block = variationBlock(["Hypothesis", "Fair test"]);
    expect(block).toContain("NEW set");
    expect(block).toContain("- Hypothesis");
    expect(block).toContain("- Fair test");
    expect(variationBlock([])).toBe("");
  });

  it("points an extra deck at exactly what the student got wrong", () => {
    const block = remedialBlock([{ prompt: "Which variable does the investigator change?", correctAnswer: "The independent variable" }]);
    expect(block).toContain("EXTRA practice set");
    expect(block).toContain("Which variable does the investigator change?");
    expect(block).toContain("The right answer: The independent variable");
    expect(remedialBlock([])).toBe("");
    expect(remedialBlock([{ prompt: "  ", correctAnswer: "x" }])).toBe("");
  });
});
