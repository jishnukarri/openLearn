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

const PDF_SPEC = `GCSE PHYSICS (8463)
Specification
Contents
1 Introduction 5
1.1 Why choose AQA for GCSE Physics 5
4 Subject content 17
4.7 Magnetism and electromagnetism 94
4.7.1 Permanent and induced magnetism, magnetic forces and fields 94
4.7.2 The motor effect 96

1 Introduction
Welcome to the specification. We have made changes to help you teach it.

4.7 Magnetism and electromagnetism
Magnetic fields and electric currents are closely linked. Magnets exert forces on other magnets and on magnetic materials.

4.7.1 Permanent and induced magnetism, magnetic forces and fields
Poles of a magnet are the places where the magnetic forces are strongest. When two magnets are brought close together they exert a force on each other. Two like poles repel each other; two unlike poles attract. A permanent magnet produces its own magnetic field.

4.7.2 The motor effect
When a conductor carrying a current is placed in a magnetic field, the magnet producing the field and the conductor exert a force on each other. This is called the motor effect.
`;

describe("a real PDF spec with a contents page", () => {
  it("skips the contents lines and finds the teaching content", () => {
    const out = findSpecExcerpt(PDF_SPEC, { name: "Magnetism and electromagnetism" });
    expect(out).toContain("Poles of a magnet");
    expect(out).not.toMatch(/Contents|Why choose AQA/);
    expect(out).not.toMatch(/\s94$/m);
  });

  it("also skips a 'subject content at a glance' list with '(page N)' entries", () => {
    const spec = `2.1 Subject content
1. Energy (page 17)
7. Magnetism and electromagnetism (page 67)

4.7 Magnetism and electromagnetism
Magnetic fields and electric currents are closely linked and each can produce the other in many devices around us.
`;
    const out = findSpecExcerpt(spec, { name: "Magnetism and electromagnetism" });
    expect(out).toContain("closely linked");
    expect(out).not.toContain("(page 67)");
  });

  it("prefers the section titled exactly like the topic, and ignores overview lists and '(physics only)'", () => {
    const spec = `2.1 Subject content
Paper 2 covers Forces; Waves; Magnetism and electromagnetism; Space physics (physics only).

4.5 Forces
A force is a push or pull that acts on an object due to the interaction with another object. Forces can change motion.

4.5.1.4 Resultant forces
A number of forces acting on an object may be replaced by a single force that has the same effect.

4.8 Space physics (physics only)
Our Sun is a star within the Milky Way galaxy. The solar system includes planets, moons and comets orbiting the Sun.
`;
    expect(findSpecExcerpt(spec, { name: "Forces" })).toMatch(/^4\.5 Forces/);
    expect(findSpecExcerpt(spec, { name: "Space physics (physics only)" })).toContain("Milky Way");
    expect(findSpecExcerpt(spec, { name: "Magnetism and electromagnetism" })).toBe("");
  });

  it("finds a subtopic's own section", () => {
    const out = findSpecExcerpt(PDF_SPEC, { name: "The motor effect", parentName: "Magnetism and electromagnetism" });
    expect(out).toContain("conductor carrying a current");
  });
});

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
