import { describe, expect, it } from "vitest";
import { estimateTextWidth, parseScene, type Scene, type SceneElement } from "./lesson-scene";
import { findTextCollisions, layoutScene, resolveTextCollisions } from "./scene-layout";

const T = (text: string, x: number, y: number, o: Partial<Extract<SceneElement, { type: "text" }>> = {}): SceneElement => ({
  type: "text", x, y, text, size: 18, anchor: "start", fill: "ink", step: 0, enter: "fade", ...o,
});
const scene = (elements: SceneElement[], w = 520, h = 340): Scene => ({
  w, h, viewBox: [0, 0, w, h], captions: ["a"], elements,
});
const texts = (s: Scene) => s.elements.filter((e) => e.type === "text") as Extract<SceneElement, { type: "text" }>[];

describe("resolveTextCollisions", () => {
  it("separates the converging-lens labels and the dimension line", () => {
    const s = scene([
      { type: "line", x1: 200, y1: 280, x2: 420, y2: 280, stroke: "ink", dashed: false, step: 1, enter: "draw" },
      T("converging lens", 260, 292),
      T("focal length = 10 cm", 310, 290, { step: 1 }),
    ]);
    expect(findTextCollisions(s).length).toBeGreaterThan(0);
    const { scene: out, unresolved } = layoutScene(s);
    expect(unresolved).toEqual([]);
    expect(findTextCollisions(out)).toEqual([]);
    const [a, b] = texts(out);
    expect(a.text).toBe("converging lens");
    expect(b.step).toBe(1);
    // input untouched
    expect(texts(s)[1].y).toBe(290);
    expect(resolveTextCollisions(s)).toEqual(out);
  });

  it("does not move text that does not collide", () => {
    const s = scene([
      T("title", 20, 24),
      T("far label", 20, 200),
      { type: "line", x1: 20, y1: 100, x2: 200, y2: 100, stroke: "ink", dashed: false, step: 0, enter: "fade" },
    ]);
    const out = resolveTextCollisions(s);
    expect(out).toEqual(s);
  });

  it("leaves text sitting inside a filled circle alone", () => {
    const s = scene([
      { type: "circle", cx: 100, cy: 100, r: 20, fill: "error", stroke: "none", step: 0, enter: "scale" },
      T("+", 100, 106, { anchor: "middle", fill: "white" }),
    ]);
    const out = resolveTextCollisions(s);
    expect(texts(out)[0]).toMatchObject({ x: 100, y: 106 });
    expect(findTextCollisions(out)).toEqual([]);
  });

  it("leaves a label inside an outlined rect alone but moves one on its border", () => {
    const rect: SceneElement = { type: "rect", x: 100, y: 100, w: 200, h: 80, rx: 0, fill: "none", stroke: "ink", step: 0, enter: "fade" };
    const inner = resolveTextCollisions(scene([rect, T("inside", 120, 145)]));
    expect(texts(inner)[0]).toMatchObject({ x: 120, y: 145 });
    const onEdge = resolveTextCollisions(scene([rect, T("on edge", 120, 104)]));
    expect(findTextCollisions(onEdge)).toEqual([]);
    expect(texts(onEdge)[0].y).not.toBe(104);
  });

  it("anchors middle and end are respected", () => {
    const s = scene([T("centred label", 200, 100, { anchor: "middle" }), T("end label", 200, 104, { anchor: "end" })]);
    expect(findTextCollisions(s).length).toBe(1);
    expect(findTextCollisions(resolveTextCollisions(s))).toEqual([]);
  });

  it("moves group children too and keeps their step", () => {
    const s = scene([
      T("alpha beta", 50, 100),
      { type: "group", step: 2, enter: "fade", children: [T("gamma delta", 55, 102, { step: 2 })] },
    ]);
    const out = resolveTextCollisions(s);
    const g = out.elements[1] as Extract<SceneElement, { type: "group" }>;
    expect(g.step).toBe(2);
    expect((g.children[0] as { step: number }).step).toBe(2);
    expect(findTextCollisions(out)).toEqual([]);
  });

  it("shrinks the font when no offset fits, and reports truly impossible cases", () => {
    // Narrow canvas fully covered by a filled bar: nowhere to go.
    const cover: SceneElement = { type: "rect", x: 0, y: 0, w: 120, h: 60, rx: 0, fill: "light", stroke: "none", step: 0, enter: "fade" };
    const s = scene([cover, T("a long overlapping label here", 100, 30), T("another overlapping label", 100, 32)], 120, 60);
    const { unresolved } = layoutScene(s);
    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved.some((c) => c.kind === "hard")).toBe(true);
  });

  it("stays inside the canvas with padding", () => {
    const s = scene([T("one two three", 10, 30), T("four five six", 12, 32)], 300, 120);
    const out = resolveTextCollisions(s);
    for (const t of texts(out)) {
      expect(t.y - t.size).toBeGreaterThanOrEqual(6);
      expect(t.x + estimateTextWidth(t.text, t.size)).toBeLessThanOrEqual(300 - 6 + 0.001);
    }
  });
});

describe("parseScene applies the layout", () => {
  it("separates overlapping labels from raw JSON", () => {
    const s = parseScene({
      w: 520, h: 340, captions: ["x"],
      elements: [
        { type: "text", x: 260, y: 292, text: "converging lens", size: 18 },
        { type: "text", x: 310, y: 290, text: "focal length = 10 cm", size: 18 },
      ],
    })!;
    expect(findTextCollisions(s)).toEqual([]);
  });
});
