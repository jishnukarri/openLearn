import { describe, expect, it } from "vitest";
import { damerauLevenshtein, isKeyTerm, matchesExpected, normaliseWord, stem } from "./spelling";
import { autoMark } from "./question-marking";

describe("normalise / stem", () => {
  it("strips case, punctuation, diacritics", () => {
    expect(normaliseWord("  Café, Réaction! ")).toBe("cafe reaction");
  });
  it("light stems", () => {
    expect(stem("cells")).toBe("cell");
    expect(stem("heating")).toBe("heat");
    expect(stem("heated")).toBe("heat");
    expect(stem("cat")).toBe("cat");
  });
});

describe("damerauLevenshtein", () => {
  it("counts transposition as 1", () => {
    expect(damerauLevenshtein("recieve", "receive")).toBe(1);
    expect(damerauLevenshtein("abc", "abc")).toBe(0);
    expect(damerauLevenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("matchesExpected ordinary words", () => {
  it("short words exact", () => {
    expect(matchesExpected("cat", "cut").matched).toBe(false);
    expect(matchesExpected("Cat", "cat")).toEqual({ matched: true, exact: true });
  });
  it("4-6 chars allow 1 edit", () => {
    expect(matchesExpected("heet", "heat").matched).toBe(true);
    expect(matchesExpected("hxxt", "heat").matched).toBe(false);
  });
  it("7+ chars allow 2 edits", () => {
    expect(matchesExpected("seperate", "separate").matched).toBe(true);
    expect(matchesExpected("definately", "definitely").matched).toBe(true);
    expect(matchesExpected("abcdefgxyz", "abcdefghij").matched).toBe(false);
  });
  it("plural and -ing tolerated", () => {
    expect(matchesExpected("cells", "cell").exact).toBe(true);
  });
  it("phrases token by token", () => {
    expect(matchesExpected("potentail energy", "potential energy").matched).toBe(true);
    expect(matchesExpected("energy", "potential energy").matched).toBe(false);
  });
});

describe("key terms", () => {
  it("curated set + contexts", () => {
    expect(isKeyTerm("Osmosis")).toBe(true);
    expect(isKeyTerm("banana")).toBe(false);
    expect(isKeyTerm("banana", { markSchemeText: 'Says "banana" is ripe' })).toBe(true);
    expect(isKeyTerm("banana", { markSchemeText: "**banana**" })).toBe(true);
    expect(isKeyTerm("banana", { fillBlankExpected: true, subject: "Biology" })).toBe(true);
    expect(isKeyTerm("banana", { fillBlankExpected: true, subject: "History" })).toBe(false);
  });
  it("confusable terms never pass", () => {
    expect(matchesExpected("mitosis", "meiosis").matched).toBe(false);
    expect(matchesExpected("meiosis", "mitosis").matched).toBe(false);
    expect(matchesExpected("ionic", "iconic", { keyTerm: true }).matched).toBe(false);
    expect(matchesExpected("exothermic", "endothermic").matched).toBe(false);
  });
  it("short key terms (<8) must be exact", () => {
    expect(matchesExpected("osmosys", "osmosis").matched).toBe(false);
    expect(matchesExpected("difusion", "diffusion").matched).toBe(true); // 9 chars, 1 edit
  });
  it("long key term, 1 edit passes with note flag", () => {
    const r = matchesExpected("photosynthesys", "photosynthesis");
    expect(r.matched).toBe(true);
    expect(r.exact).toBe(false);
    expect(r.misspelledKeyTerm).toBe("photosynthesis");
  });
  it("2 edits on key term fails", () => {
    expect(matchesExpected("photosyntheses", "photosynthesis").matched).toBe(true);
    expect(matchesExpected("fotosynthesys", "photosynthesis").matched).toBe(false);
  });
});

describe("autoMark short-answer spelling", () => {
  const fmt = { type: "short-answer", accepted: ["photosynthesis"] } as { type: "short-answer"; accepted: string[] };
  it("passes ordinary misspelling and notes key-term slips", () => {
    const r = autoMark(fmt, { text: "photosynthesys" }, 1)!;
    expect(r.marksAwarded).toBe(1);
    expect(r.feedback[0].comment).toContain('Check the spelling of "photosynthesis"');
  });
  it("ordinary word typo earns mark", () => {
    const r = autoMark({ type: "short-answer", accepted: ["the seperate answer"] } as never, { text: "the separate answer" }, 1)!;
    expect(r.marksAwarded).toBe(1);
  });
});
