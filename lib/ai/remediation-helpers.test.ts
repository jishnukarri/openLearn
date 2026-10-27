import { describe, expect, it } from "vitest";
import {
  checkScaffoldAnswer,
  checkTransferAnswer,
  extractJsonObject,
  remediationKind,
  validateHints,
  validateRemediation,
  type RemediationInput,
} from "./remediation-helpers";

const mean: RemediationInput = {
  prompt: "Calculate the mean of 4, 8, 6, 10 and 12.",
  markscheme: [{ point: "sum = 40" }, { point: "40 / 5 = 8" }],
  maxMarks: 2,
  modelAnswer: "8",
  format: { type: "numeric", answer: "8" },
};

const recall: RemediationInput = {
  prompt: "Name the process by which water moves through a partially permeable membrane.",
  markscheme: [{ point: "osmosis" }],
  maxMarks: 1,
  modelAnswer: "Osmosis",
  format: { type: "short-answer", accepted: ["osmosis"] },
};

const steps = (lastAnswer: number | string) => ({
  steps: [
    { prompt: "Add up all five values.", kind: "numeric", answer: 40 },
    { prompt: "How many values are there?", kind: "numeric", answer: 5 },
    { prompt: "Write mean = sum / count as a fraction.", kind: "fraction", answer: "40/5" },
    { prompt: "Work out the mean.", kind: "numeric", answer: lastAnswer, hint: "Divide the top by the bottom." },
  ],
});

describe("extractJsonObject", () => {
  it("handles fences and prose", () => {
    expect(extractJsonObject('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('sure {"a":{"scene":2}} done')).toEqual({ a: { scene: 2 } });
  });
});

describe("validateHints", () => {
  const good = {
    hints: [
      "This is about finding an average of a set of numbers.",
      "Think about how you share a total equally between the values.",
      "Try it on 2, 4 and 9 first: add them, then divide by how many there are.",
    ],
  };
  it("accepts safe hints", () => {
    expect(validateHints(good, mean).ok).toBe(true);
  });
  it("rejects wrong count and blanks", () => {
    expect(validateHints({ hints: ["only one hint here, ok"] }, mean).ok).toBe(false);
    expect(validateHints({ hints: [...good.hints.slice(0, 2), "A word starting with … here"] }, mean).ok).toBe(false);
  });
  it("rejects a hint with the accepted answer", () => {
    const r = validateHints({ hints: [good.hints[0], good.hints[1], "The answer you want is osmosis, so write that."] }, recall);
    expect(r.ok).toBe(false);
  });
  it("rejects a hint with a numeric answer", () => {
    const withAnswer = { hints: [good.hints[0], good.hints[1], "The total is 400 and the answer is 1234 here."] };
    expect(validateHints(withAnswer, { ...mean, format: { type: "numeric", answer: "1234" } }).ok).toBe(false);
  });
  it("rejects a verbatim mark scheme point", () => {
    const r = validateHints(
      { hints: [good.hints[0], good.hints[1], "Particles collide more frequently with each other"] },
      { ...recall, markscheme: [{ point: "Particles collide more frequently with each other" }], format: { type: "extended" } }
    );
    expect(r.ok).toBe(false);
  });
});

describe("remediationKind", () => {
  it("scaffolds numeric, explains recall", () => {
    expect(remediationKind(mean)).toBe("scaffold");
    expect(remediationKind(recall)).toBe("explain");
  });
  it("scaffolds maths-like free text with a numeric model answer", () => {
    expect(remediationKind({ ...mean, format: { type: "extended" }, modelAnswer: "mean = 40/5 = 8" })).toBe("scaffold");
  });
  it("explains when no number can be checked", () => {
    expect(remediationKind({ ...mean, format: { type: "extended" }, modelAnswer: "eight" })).toBe("explain");
  });
});

describe("validateScaffold", () => {
  it("accepts a chain ending in the question answer", () => {
    expect(validateRemediation(steps(8), mean, "scaffold").ok).toBe(true);
  });
  it("rejects when the last step differs from the answer", () => {
    const r = validateRemediation(steps(9), mean, "scaffold");
    expect(r.ok).toBe(false);
  });
  it("rejects too few steps and bad shapes", () => {
    expect(validateRemediation({ steps: steps(8).steps.slice(0, 2) }, mean, "scaffold").ok).toBe(false);
    const bad = steps(8);
    (bad.steps[2] as { answer: string }).answer = "40";
    expect(validateRemediation(bad, mean, "scaffold").ok).toBe(false);
  });
  it("rejects a step hint that leaks the answer", () => {
    const s = steps(8);
    (s.steps[3] as { hint: string }).hint = "It is 8 in the end.";
    expect(validateRemediation(s, mean, "scaffold").ok).toBe(false);
  });
});

describe("validateExplain", () => {
  const content = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
  const mcq = { prompt: "Which of these describes diffusion of a gas in a room?", kind: "mcq", options: ["a", "b", "c", "d"], correctIndex: 2 };
  it("accepts good content with an mcq", () => {
    const r = validateRemediation({ content, transferCheck: mcq }, recall, "explain");
    expect(r.ok && r.remediation.type === "explain" && r.remediation.scene === null).toBe(true);
  });
  it("accepts a short check", () => {
    const tc = { prompt: "What is the movement of particles from high to low concentration called?", kind: "short", accepted: ["diffusion"] };
    expect(validateRemediation({ content, transferCheck: tc }, recall, "explain").ok).toBe(true);
  });
  it("rejects word counts, bad index and a copied question", () => {
    expect(validateRemediation({ content: "too short", transferCheck: mcq }, recall, "explain").ok).toBe(false);
    expect(validateRemediation({ content, transferCheck: { ...mcq, correctIndex: 4 } }, recall, "explain").ok).toBe(false);
    expect(validateRemediation({ content, transferCheck: { ...mcq, prompt: recall.prompt } }, recall, "explain").ok).toBe(false);
  });
  it("drops an invalid scene instead of failing", () => {
    const r = validateRemediation({ content, scene: { junk: true }, transferCheck: mcq }, recall, "explain");
    expect(r.ok).toBe(true);
  });
});

describe("answer checking", () => {
  it("numeric step tolerates formatting", () => {
    const s = { prompt: "x", kind: "numeric" as const, answer: 40 };
    expect(checkScaffoldAnswer(s, "40")).toBe(true);
    expect(checkScaffoldAnswer(s, "41")).toBe(false);
    expect(checkScaffoldAnswer(s, "")).toBe(false);
  });
  it("fraction step accepts equivalents", () => {
    const s = { prompt: "x", kind: "fraction" as const, answer: "40/5" };
    expect(checkScaffoldAnswer(s, "40/5")).toBe(true);
    expect(checkScaffoldAnswer(s, "8/1")).toBe(true);
    expect(checkScaffoldAnswer(s, "5/40")).toBe(false);
  });
  it("text step tolerates a typo", () => {
    const s = { prompt: "x", kind: "text" as const, answer: "denominator" };
    expect(checkScaffoldAnswer(s, "denominater")).toBe(true);
    expect(checkScaffoldAnswer(s, "numerator")).toBe(false);
  });
  it("transfer mcq by index or text, short by accepted", () => {
    const m = { prompt: "p", kind: "mcq" as const, options: ["a", "b", "c", "d"], correctIndex: 2 };
    expect(checkTransferAnswer(m, "2")).toBe(true);
    expect(checkTransferAnswer(m, "C")).toBe(true);
    expect(checkTransferAnswer(m, "1")).toBe(false);
    expect(checkTransferAnswer({ prompt: "p", kind: "short", accepted: ["diffusion"] }, "Diffusion")).toBe(true);
  });
});
