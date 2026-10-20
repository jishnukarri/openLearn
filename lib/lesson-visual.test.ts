import { describe, expect, it } from "vitest";
import { sanitizeVisual } from "./lesson-visual";

describe("sanitizeVisual images", () => {
  const img = { kind: "image" as const, prompt: "", alt: "", url: "https://x.test/a.png" };
  it("keeps an uploaded image with alt", () => {
    expect(sanitizeVisual({ ...img, alt: "A graph" })).toMatchObject({ url: img.url, alt: "A graph" });
  });
  it("defaults missing alt to the section heading instead of dropping", () => {
    expect(sanitizeVisual({ ...img, alt: "  " }, "Fractions")).toMatchObject({ url: img.url, alt: "Fractions" });
  });
  it("drops an image with neither alt nor fallback, or an unsafe url", () => {
    expect(sanitizeVisual(img)).toBeNull();
    expect(sanitizeVisual({ ...img, url: "javascript:alert(1)", alt: "a" })).toBeNull();
  });
  it("keeps AI image with prompt+alt and drops empty ones", () => {
    expect(sanitizeVisual({ kind: "image", prompt: "p", alt: "a" })).not.toBeNull();
    expect(sanitizeVisual({ kind: "image", prompt: "", alt: "a" })).toBeNull();
    expect(sanitizeVisual(null)).toBeNull();
  });
  it("sanitizes svg and drops empty svg", () => {
    expect(sanitizeVisual({ kind: "svg", svg: "" })).toBeNull();
  });
});
