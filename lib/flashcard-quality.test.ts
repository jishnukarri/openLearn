import { describe, it, expect } from "vitest";
import { validateCard, filterCards, isDeckUsable, lessonVocabCard } from "./flashcard-quality";

const bad = (front: string, back: string) => expect(validateCard({ front, back }).ok).toBe(false);
const good = (front: string, back: string) => expect(validateCard({ front, back }).ok).toBe(true);

describe("validateCard", () => {
  it("accepts genuine term/definition", () => {
    good("Osmosis", "The movement of water across a partially permeable membrane from dilute to concentrated solution.");
    good("Mitochondria", "Organelles where aerobic respiration releases energy.");
    good("Speed", "Distance travelled per unit time.");
  });
  it("accepts question/answer", () => {
    good("What is the formula for density?", "Density = mass / volume");
    good("Which gas do plants take in for photosynthesis?", "Carbon dioxide");
  });
  it("rejects empty", () => { bad("", "x y"); bad("Term", "  "); });
  it("rejects back repeating front", () => {
    bad("Osmosis", "osmosis");
    bad("Photosynthesis", "Photosynthesis.");
    bad("Cell wall", "The cell wall");
  });
  it("rejects long sentence fronts without question mark", () => {
    bad("Plants make glucose using light energy in their leaves every single day of the year", "Photosynthesis.");
    bad("The heart pumps blood around the body.", "Because it is a muscle that contracts.");
  });
  it("rejects lesson references", () => {
    bad("Enzyme", "A biological catalyst, as shown above.");
    bad("Enzyme", "See the lesson for details on catalysts.");
    bad("Enzyme", "Described below in this lesson.");
    bad("What does this do?", "It speeds reactions.");
  });
  it("rejects over-long and truncated answers", () => {
    bad("Enzyme", "word ".repeat(40));
    bad("Enzyme", "An enzyme is a biological catalyst that speeds up…");
  });
  it("rejects unresolved pronoun fronts", () => bad("This process", "Water moves across a membrane."));
  it("rejects mismatched term and answer", () => {
    bad("Resistance", "Volcanoes erupt violently along tectonic plate boundaries worldwide.");
    bad("Democracy", "Mitochondria sit inside animal cells and make energy for them.");
  });
  it("tolerates spelling variation", () => {
    good("Colour", "Colours are produced by different wavelengths of light.");
    good("Photosynthesis", "Plants make glucose by photosynthesys using light.");
  });
});

describe("filterCards", () => {
  it("removes duplicates after normalising", () => {
    const out = filterCards([
      { front: "Speed", back: "Distance travelled per unit time." },
      { front: "speed!", back: "Distance travelled per unit of time" },
      { front: "Velocity", back: "Speed in a given direction." },
    ]);
    expect(out.map((c) => c.front)).toEqual(["Speed", "Velocity"]);
  });
  it("handles null and malformed", () => {
    expect(filterCards(null)).toEqual([]);
    expect(filterCards([{ front: 1, back: 2 } as never])).toEqual([]);
  });
  it("deck usability threshold", () => {
    expect(isDeckUsable([{ front: "a", back: "b" }])).toBe(false);
    expect(isDeckUsable(Array(3).fill({ front: "a", back: "b" }))).toBe(true);
  });
});

describe("lessonVocabCard", () => {
  it("builds a card from heading and defining sentence", () => {
    const c = lessonVocabCard("Osmosis", "Cells need water. Osmosis is the movement of water across a membrane.");
    expect(c?.back).toBe("Osmosis is the movement of water across a membrane.");
  });
  it("returns null for non-card-shaped sections", () => {
    expect(lessonVocabCard("Why it matters in the real world today for everyone who lives here", "Volcanoes erupt.")).toBeNull();
  });
});

describe("validateCard: legitimate notation and short terms", () => {
  const ok = (front: string, back: string) => expect(validateCard({ front, back }).ok).toBe(true);
  it("accepts acronym fronts", () => {
    ok("ATP", "Adenosine triphosphate, the cell's energy currency");
    ok("DNA", "Deoxyribonucleic acid, the molecule carrying genetic information");
  });
  it("accepts single-character and numeric answers", () => {
    ok("How many electrons does helium have?", "2");
    ok("pH of a neutral solution", "7");
  });
  it("accepts maths and chemistry notation", () => {
    ok("Speed formula", "v = d / t");
    ok("Area of a circle?", "πr²");
    ok("Equation for photosynthesis?", "6CO2 + 6H2O → C6H12O6 + 6O2");
    ok("Product of photosynthesis", "Glucose and oxygen released by the plant");
  });
  it("still rejects punctuation-only answers", () => {
    expect(validateCard({ front: "Term", back: "?!" }).ok).toBe(false);
  });
});
