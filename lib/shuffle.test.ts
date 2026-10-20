import { describe, expect, it } from "vitest";
import { attemptSeed, seededShuffle, shuffleOptions, shouldShuffleOptions } from "./shuffle";

describe("seededShuffle", () => {
  it("is deterministic and a permutation", () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6], "x");
    expect(seededShuffle([1, 2, 3, 4, 5, 6], "x")).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("changes with the seed", () => {
    const orders = new Set(Array.from({ length: 12 }, (_, i) => seededShuffle([1, 2, 3, 4], `s${i}`).join()));
    expect(orders.size).toBeGreaterThan(3);
  });
  it("does not mutate input", () => {
    const src = [1, 2, 3];
    seededShuffle(src, "q");
    expect(src).toEqual([1, 2, 3]);
  });
});

describe("shuffleOptions", () => {
  const opts = ["Mitochondria", "Nucleus", "Ribosome", "Vacuole"];
  it("position maps original index to displayed index", () => {
    for (let i = 0; i < 20; i++) {
      const s = shuffleOptions("Which organelle?", opts, `k${i}`);
      expect(s.options[s.position[2]]).toBe("Ribosome");
      expect(s.order.map((o) => opts[o])).toEqual(s.options);
    }
  });
  it("gives different orders across attempts", () => {
    const seen = new Set(Array.from({ length: 10 }, (_, a) => shuffleOptions("Q?", opts, attemptSeed("t", 0, a, 0)).options.join()));
    expect(seen.size).toBeGreaterThan(2);
  });
  it("keeps all-of-the-above last", () => {
    const o = ["Red", "Blue", "Green", "All of the above"];
    for (let i = 0; i < 20; i++) expect(shuffleOptions("Which?", o, `a${i}`).options[3]).toBe("All of the above");
  });
  it("leaves numeric ranges and ordering questions alone", () => {
    expect(shouldShuffleOptions("How many?", ["0-10", "11-20", "21-30"])).toBe(false);
    expect(shouldShuffleOptions("Put these in order of size", ["a cell", "a tissue", "an organ"])).toBe(false);
    expect(shuffleOptions("How many?", ["1", "2", "3"], "z").options).toEqual(["1", "2", "3"]);
  });
  it("shuffles true/false-style statements", () => {
    expect(shouldShuffleOptions("Which statement is true?", ["Heat rises", "Cold rises"])).toBe(true);
  });
});
