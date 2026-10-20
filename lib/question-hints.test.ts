import { describe, expect, it } from "vitest";
import {
  clampHintLevel,
  deriveHints,
  findCommandWord,
  hintIsSafe,
  hintSimilarity,
  isHintCopy,
  maskPoint,
  maskSecrets,
  maxPointOverlap,
  MAX_HINT_LEVEL,
  type HintInput,
} from "./question-hints";

const extended: HintInput = {
  prompt: "Explain why the rate of reaction increases when the temperature is raised.",
  maxMarks: 3,
  topicTitle: "Rates of reaction",
  format: { type: "extended" },
  markscheme: [
    { point: "Particles have more kinetic energy at a higher temperature" },
    { point: "Particles collide more frequently with each other" },
    { point: "A greater proportion of collisions exceed the activation energy" },
  ],
};

describe("deriveHints ladder", () => {
  it("returns three levels", () => {
    expect(deriveHints(extended)).toHaveLength(MAX_HINT_LEVEL);
  });

  it("L1 gives marks, command word guidance and topic", () => {
    const [l1] = deriveHints(extended);
    expect(l1).toContain("worth 3 marks");
    expect(l1).toContain("aim for 3 separate points");
    expect(l1).toMatch(/Explain means/);
    expect(l1).toContain("Rates of reaction");
  });

  it("1-mark questions ask for one precise point", () => {
    const [l1] = deriveHints({ ...extended, maxMarks: 1, markscheme: [{ point: "Osmosis" }] });
    expect(l1).toContain("worth 1 mark");
    expect(l1).not.toContain("1 marks");
  });

  it("L2 has one masked line per point", () => {
    const l2 = deriveHints(extended)[1].split("\n");
    expect(l2).toHaveLength(3);
    expect(l2.join(" ")).not.toMatch(/kinetic|activation|collide/i);
    expect(l2.join(" ")).toContain("…");
  });

  it("L3 reveals only first letter and length per point", () => {
    const l3 = deriveHints(extended)[2].split("\n");
    expect(l3).toHaveLength(3);
    for (const line of l3) expect(line).toMatch(/starts with "\w" and has \d+ letters/);
    expect(l3.join(" ")).not.toMatch(/kinetic energy|activation energy/i);
  });

  it("is deterministic", () => {
    expect(deriveHints(extended)).toEqual(deriveHints(extended));
  });

  it("falls back safely with an empty mark scheme", () => {
    const hints = deriveHints({ ...extended, markscheme: [] });
    expect(hints).toHaveLength(3);
    for (const h of hints) expect(h.length).toBeGreaterThan(0);
  });

  it("labels structured parts", () => {
    const hints = deriveHints({
      prompt: "Answer both parts.",
      maxMarks: 2,
      markscheme: [],
      format: {
        type: "structured",
        parts: [
          { label: "a", prompt: "State x", marks: 1, markscheme: [{ point: "Chlorophyll absorbs light" }] },
          { label: "b", prompt: "Explain y", marks: 1, markscheme: [{ point: "Glucose is stored as starch" }] },
        ],
      },
    });
    expect(hints[0]).toContain("2 parts");
    expect(hints[1]).toContain("Point 1 (a)");
    expect(hints[1]).toContain("Point 2 (b)");
  });
});

describe("never leaks the mark scheme", () => {
  const schemes = [
    "Ionic compounds have high melting points because of strong electrostatic forces between oppositely charged ions",
    "The rate decreases",
    "Water moves from a dilute solution to a concentrated solution through a partially permeable membrane",
    "Osmosis",
    "Mitochondria release energy by aerobic respiration",
  ];
  for (const point of schemes) {
    it(`<=60% overlap for: ${point.slice(0, 40)}`, () => {
      const hints = deriveHints({
        prompt: "Describe it.",
        maxMarks: 2,
        markscheme: [{ point }, { point: "Another separate valid point" }],
        format: { type: "extended" },
      });
      for (const h of hints) expect(maxPointOverlap(h, [point])).toBeLessThanOrEqual(0.6);
    });
  }

  it("masks accepted short answers everywhere", () => {
    const hints = deriveHints({
      prompt: "Name the organelle where respiration happens.",
      maxMarks: 1,
      topicTitle: "Cells",
      markscheme: [{ point: "Mitochondria (accept mitochondrion)" }],
      format: { type: "short-answer", accepted: ["mitochondria", "mitochondrion"] },
    });
    for (const h of hints) {
      expect(h.toLowerCase()).not.toContain("mitochondri");
    }
    expect(hints[2]).toContain('starts with "m"');
  });

  it("masks numeric answers and keeps formula without numbers", () => {
    const hints = deriveHints({
      prompt: "Calculate the force.",
      maxMarks: 3,
      topicTitle: "Forces",
      markscheme: [
        { point: "force = mass × acceleration" },
        { point: "F = 4 × 2.5" },
        { point: "10 N" },
      ],
      format: { type: "calculation", answer: "10", unit: "N" },
    });
    expect(hints[1]).toContain("Use: force = mass × acceleration");
    expect(hints[1]).toContain("Give your answer in N.");
    expect(hints[1]).not.toContain("2.5");
    expect(hints.join(" ")).not.toMatch(/\b4 ×/);
  });

  it("does not offer a formula containing worked numbers", () => {
    const [, l2] = deriveHints({
      prompt: "Calculate.",
      maxMarks: 2,
      markscheme: [{ point: "F = 4 × 2.5 = 10" }],
      format: { type: "calculation", answer: "10" },
    });
    expect(l2).not.toContain("Use:");
  });

  it("hintIsSafe rejects secrets and long overlaps", () => {
    expect(hintIsSafe("the answer is mitochondria", ["x"], ["mitochondria"])).toBe(false);
    expect(hintIsSafe("it is 0.25 here", ["x"], ["0.25"])).toBe(false);
    expect(hintIsSafe("worth 3 marks", ["x"], ["3"])).toBe(true);
    expect(
      hintIsSafe("particles collide more frequently with each", ["Particles collide more frequently with each other"])
    ).toBe(false);
    expect(hintIsSafe("particles … frequently", ["Particles collide more frequently with each other"])).toBe(true);
  });
});

describe("maskPoint / maskSecrets", () => {
  it("keeps framing and blanks key terms and numbers", () => {
    expect(maskPoint("The rate increases when the temperature is 50 degrees")).toBe(
      "the … increases when the … is …"
    );
  });
  it("collapses consecutive blanks", () => {
    expect(maskPoint("Photosynthesis produces glucose")).toBe("…");
  });
  it("masks secrets case-insensitively on word boundaries", () => {
    expect(maskSecrets("Osmosis is osmosis, not osmosisx", ["osmosis"])).toBe("… is …, not osmosisx");
  });
});

describe("MCQ and matching", () => {
  const mcq: HintInput = {
    prompt: "Which is a noble gas?",
    maxMarks: 1,
    markscheme: [{ point: "Argon" }],
    format: { type: "multiple-choice", options: ["Oxygen", "Argon", "Chlorine", "Sodium"], correctIndexes: [1] },
  };
  it("eliminates a wrong option at L2 and another at L3, never the correct one", () => {
    const hints = deriveHints(mcq);
    expect(hints[1]).toContain("Option A is not correct");
    expect(hints[2]).toContain("Options A and C");
    expect(hints[1] + hints[2]).not.toContain("Option B");
  });
  it("keeps two options standing with only three options", () => {
    const hints = deriveHints({
      ...mcq,
      format: { type: "multiple-choice", options: ["Oxygen", "Argon", "Sodium"], correctIndexes: [1] },
    });
    expect(hints[2]).not.toContain("both not correct");
  });
  it("matching gets generic non-leaking hints", () => {
    const hints = deriveHints({
      prompt: "Match.",
      maxMarks: 2,
      markscheme: [],
      format: { type: "matching", pairs: [{ left: "a", right: "b" }, { left: "c", right: "d" }] },
    });
    expect(hints).toHaveLength(3);
  });
});

describe("findCommandWord", () => {
  it("finds the earliest command word", () => {
    expect(findCommandWord("Calculate the speed, then explain it")).toBe("calculate");
    expect(findCommandWord("(a) State one use. (b) Compare")).toBe("state");
    expect(findCommandWord("What is osmosis?")).toBeNull();
  });
});

describe("clampHintLevel", () => {
  it("clamps odd input", () => {
    expect(clampHintLevel("2")).toBe(2);
    expect(clampHintLevel("9")).toBe(3);
    expect(clampHintLevel("-1")).toBe(0);
    expect(clampHintLevel("x")).toBe(0);
    expect(clampHintLevel(null)).toBe(0);
  });
});

describe("hint copy detection", () => {
  const hints = deriveHints(extended);

  it("flags a pasted hint and a pasted line", () => {
    expect(isHintCopy(hints[0], hints.slice(0, 1))).toBe(true);
    const line = hints[1].split("\n")[0];
    expect(isHintCopy(line, hints.slice(0, 2))).toBe(true);
    expect(isHintCopy(line.replace(/^Point \d+: /, ""), hints.slice(0, 2))).toBe(true);
  });

  it("flags lightly edited copies", () => {
    expect(isHintCopy(hints[0].replace("aim for", "try for"), hints.slice(0, 1))).toBe(true);
  });

  it("does not flag a genuine answer", () => {
    const real =
      "At a higher temperature the particles have more kinetic energy so they collide more often and more collisions have enough energy to react";
    expect(isHintCopy(real, hints)).toBe(false);
  });

  it("does not flag blanks filled with real content alongside the framing", () => {
    expect(isHintCopy("the rate increases when the temperature increases", ["Point 1: the … increases when the … increases"])).toBe(false);
  });

  it("only checks hints that were shown", () => {
    expect(isHintCopy(hints[0], [])).toBe(false);
    expect(isHintCopy("", hints)).toBe(false);
  });

  it("short answers are not flagged by incidental words", () => {
    expect(isHintCopy("temperature", hints)).toBe(false);
  });

  it("hintSimilarity is symmetric-ish and bounded", () => {
    const s = hintSimilarity("a b c d", "a b c d");
    expect(s.dice).toBe(1);
    expect(hintSimilarity("", "x").dice).toBe(0);
  });
});
