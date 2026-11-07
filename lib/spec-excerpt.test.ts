import { describe, expect, it } from "vitest";
import { findSpecExcerpt, splitSpecSections, termsOf } from "./spec-excerpt";

const SPEC = `
3.1 Energy stores and transfers
Students should be able to describe energy stores, including kinetic, gravitational potential and elastic potential energy.
Energy is conserved: it can be transferred usefully, stored or dissipated, but never created or destroyed.

3.2 Waves
Students should know that waves transfer energy without transferring matter.
Students should be able to describe the difference between transverse and longitudinal waves, and give examples of each.

3.3 Electricity
Students should recall that current is the rate of flow of charge, measured in amperes.
Students should be able to use the equation charge = current × time.

PAPER 2 SCIENTIFIC INQUIRY
Students should be able to write a testable hypothesis and identify independent, dependent and control variables.
`;

describe("splitSpecSections", () => {
  it("cuts a spec at its numbered and capitalised headings", () => {
    const s = splitSpecSections(SPEC);
    expect(s.map((x) => x.heading)).toEqual([
      "3.1 Energy stores and transfers",
      "3.2 Waves",
      "3.3 Electricity",
      "PAPER 2 SCIENTIFIC INQUIRY",
    ]);
    expect(s[1].text).toContain("transverse and longitudinal");
  });

  it("returns nothing for empty text", () => {
    expect(splitSpecSections("")).toEqual([]);
  });
});

describe("termsOf", () => {
  it("matches plurals and drops filler", () => {
    expect(termsOf("The waves")).toEqual(termsOf("wave"));
    expect(termsOf("How to describe it")).toEqual([]);
  });
});

describe("findSpecExcerpt", () => {
  it("returns the part of the spec about the topic, not the rest", () => {
    const out = findSpecExcerpt(SPEC, { name: "Transverse waves" });
    expect(out).toContain("3.2 Waves");
    expect(out).toContain("transverse and longitudinal");
    expect(out).not.toContain("amperes");
  });

  it("uses a subtopic's own name first, then its topic as a weaker hint", () => {
    const out = findSpecExcerpt(SPEC, { name: "Writing a hypothesis", parentName: "Scientific inquiry" });
    expect(out).toContain("testable hypothesis");
    expect(out).not.toContain("kinetic");
  });

  it("returns nothing when no part of the spec is about the topic", () => {
    expect(findSpecExcerpt(SPEC, { name: "Medieval castles" })).toBe("");
    expect(findSpecExcerpt("", { name: "Waves" })).toBe("");
  });

  it("stays within the size limit", () => {
    const big = Array.from({ length: 30 }, (_, i) => `4.${i} Waves part ${i}\n${"Waves carry energy. ".repeat(60)}`).join("\n\n");
    expect(findSpecExcerpt(big, { name: "Waves" }, 1500).length).toBeLessThanOrEqual(1700);
  });
});
