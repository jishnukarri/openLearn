import { describe, it, expect } from "vitest";
import { tourKeyDelta, type TourKeyEvent } from "./tour-keys";

const ev = (over: Partial<TourKeyEvent> = {}): TourKeyEvent => ({
  key: "ArrowRight", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, defaultPrevented: false,
  target: { tagName: "BODY" }, ...over,
});

describe("tourKeyDelta", () => {
  it("steps on plain arrows", () => {
    expect(tourKeyDelta(ev())).toBe(1);
    expect(tourKeyDelta(ev({ key: "ArrowLeft" }))).toBe(-1);
  });
  it("leaves arrows to form fields", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(tourKeyDelta(ev({ target: { tagName } }))).toBe(0);
    expect(tourKeyDelta(ev({ target: { tagName: "DIV", isContentEditable: true } }))).toBe(0);
  });
  it("leaves arrows to sliders and handled events", () => {
    expect(tourKeyDelta(ev({ target: { tagName: "DIV", getAttribute: () => "slider" } }))).toBe(0);
    expect(tourKeyDelta(ev({ defaultPrevented: true }))).toBe(0);
  });
  it("ignores modified and other keys", () => {
    expect(tourKeyDelta(ev({ altKey: true }))).toBe(0);
    expect(tourKeyDelta(ev({ key: "Enter" }))).toBe(0);
  });
});
