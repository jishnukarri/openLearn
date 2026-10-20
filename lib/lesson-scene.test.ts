import { describe, expect, it } from "vitest";
import { countElements, MAX_ELEMENTS, parseScene } from "./lesson-scene";

const base = {
  captions: ["One", "Two", "Three"],
  elements: [
    { type: "circle", cx: 100, cy: 100, r: 10, fill: "error", step: 0 },
    { type: "arrow", x1: 0, y1: 0, x2: 50, y2: 50, stroke: "primary", step: 1, enter: "draw", motion: { type: "flow", dots: 3 } },
  ],
};

describe("parseScene", () => {
  it("accepts a valid scene and keeps steps/motion", () => {
    const s = parseScene(base)!;
    expect(s.captions).toHaveLength(3);
    expect(s.elements[1]).toMatchObject({ type: "arrow", step: 1, enter: "draw", motion: { type: "flow", dots: 3 } });
    expect(s.viewBox).toEqual([0, 0, 400, 260]);
  });

  it("rejects malformed scenes", () => {
    expect(parseScene(null)).toBeNull();
    expect(parseScene("x")).toBeNull();
    expect(parseScene({ captions: [], elements: base.elements })).toBeNull();
    expect(parseScene({ captions: ["a"], elements: [] })).toBeNull();
    expect(parseScene({ captions: ["a"], elements: [{ type: "script" }] })).toBeNull();
    expect(parseScene({ captions: ["a"] })).toBeNull();
  });

  it("clamps numbers, steps and unknown colours", () => {
    const s = parseScene({
      w: 99999, h: 1,
      captions: ["a", "b"],
      elements: [{ type: "circle", cx: 1e9, cy: "5", r: -4, fill: "#ff0000", step: 99 }],
    })!;
    expect(s.w).toBe(800);
    expect(s.h).toBe(120);
    expect(s.elements[0]).toMatchObject({ cx: 1100, cy: 5, r: 1, fill: "none", step: 1 });
  });

  it("caps total elements at 60 including group children", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ type: "circle", cx: i, cy: 5, r: 2 }));
    expect(countElements(parseScene({ captions: ["a"], elements: many })!.elements)).toBeLessThanOrEqual(MAX_ELEMENTS);
    const g = { type: "group", children: many.slice(0, 50) };
    const s = parseScene({ captions: ["a"], elements: [g, g, g] })!;
    expect(countElements(s.elements)).toBeLessThanOrEqual(MAX_ELEMENTS);
  });

  it("rejects unsafe paths and nested groups", () => {
    expect(parseScene({ captions: ["a"], elements: [{ type: "path", d: "M0 0 url(javascript:1)" }] })).toBeNull();
    expect(parseScene({ captions: ["a"], elements: [{ type: "path", d: "M0 0 C 10 10 20 20 30 30", stroke: "ink" }] })).not.toBeNull();
    const nested = { type: "group", children: [{ type: "group", children: [{ type: "circle", cx: 1, cy: 1 }] }] };
    expect(parseScene({ captions: ["a"], elements: [nested] })).toBeNull();
  });

  it("drops motions that do not fit the element", () => {
    const s = parseScene({
      captions: ["a"],
      elements: [{ type: "rect", x: 0, y: 0, motion: { type: "flow" } }],
    })!;
    expect(s.elements[0].motion).toBeUndefined();
  });

  it("grows the viewBox for long labels", () => {
    const s = parseScene({
      captions: ["a"],
      elements: [{ type: "text", x: 300, y: 20, text: "Electric field lines around a positive charge", size: 14 }],
    })!;
    expect(s.viewBox[2]).toBeGreaterThan(400);
  });
});

import { builtinSceneFor } from "./builtin-scenes";
describe("builtinSceneFor", () => {
  it("matches common physics ideas and returns a valid scene", () => {
    const f = builtinSceneFor("Electric field lines", "")!;
    expect(f.captions.length).toBeGreaterThanOrEqual(3);
    expect(countElements(f.elements)).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(builtinSceneFor("Velocity-time graphs", "")).not.toBeNull();
  });
  it("returns null when nothing matches", () => {
    expect(builtinSceneFor("Photosynthesis", "plants make glucose")).toBeNull();
  });
});
