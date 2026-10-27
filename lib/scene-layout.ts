// Deterministic label layout for animated scenes. Text elements that collide
// with other text (hard) or with lines/shapes (soft) are nudged into clear
// space; text that does not collide is never moved. Pure: no I/O, no clock.
import { estimateTextWidth, type Scene, type SceneElement } from "./lesson-scene";

type TextEl = Extract<SceneElement, { type: "text" }>;
type Box = { x0: number; y0: number; x1: number; y1: number };

export type Collision = {
  kind: "hard" | "soft";
  a: string; // the label that could not be placed
  b: string; // the other label, or a shape description
};

const PAD = 6; // keep text this far inside the canvas
const LINE_HALF = 3; // lines/arrows are treated as ~6px thick
const RING_STEP = 12;
const RING_MAX = 60;
const MIN_SIZE = 16;

const textBox = (t: TextEl, size = t.size, x = t.x, y = t.y): Box => {
  const w = estimateTextWidth(t.text, size);
  const left = t.anchor === "middle" ? x - w / 2 : t.anchor === "end" ? x - w : x;
  return { x0: left, y0: y - size, x1: left + w, y1: y + size * 0.25 };
};
const shrink = (b: Box, d: number): Box => ({ x0: b.x0 + d, y0: b.y0 + d, x1: b.x1 - d, y1: b.y1 - d });
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (inner: Box, outer: Box) =>
  inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0 && inner.y1 <= outer.y1;

// Liang-Barsky: does segment (x1,y1)-(x2,y2) touch the box?
function segHitsBox(x1: number, y1: number, x2: number, y2: number, b: Box): boolean {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - b.x0, b.x1 - x1, y1 - b.y0, b.y1 - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return true;
}

// An obstacle answers: does this text box collide with me?
type Obstacle = { desc: string; test: (b: Box) => boolean };

const rectBox = (x: number, y: number, w: number, h: number): Box => ({ x0: x, y0: y, x1: x + w, y1: y + h });
const strips = (b: Box, t: number): Box[] => [
  { x0: b.x0 - t, y0: b.y0 - t, x1: b.x1 + t, y1: b.y0 + t },
  { x0: b.x0 - t, y0: b.y1 - t, x1: b.x1 + t, y1: b.y1 + t },
  { x0: b.x0 - t, y0: b.y0 - t, x1: b.x0 + t, y1: b.y1 + t },
  { x0: b.x1 - t, y0: b.y0 - t, x1: b.x1 + t, y1: b.y1 + t },
];

function polylineObstacle(desc: string, pts: [number, number][], half: number): Obstacle {
  return {
    desc,
    test: (b) => {
      if (pts.length === 1) return hit(b, { x0: pts[0][0] - half, y0: pts[0][1] - half, x1: pts[0][0] + half, y1: pts[0][1] + half });
      const inflated = { x0: b.x0 - half, y0: b.y0 - half, x1: b.x1 + half, y1: b.y1 + half };
      for (let i = 0; i + 1 < pts.length; i++) if (segHitsBox(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], inflated)) return true;
      return false;
    },
  };
}

function hollowOrFilledBox(desc: string, box: Box, filled: boolean): Obstacle {
  const edges = strips(box, LINE_HALF);
  return {
    desc,
    test: (b) => {
      if (!hit(b, { x0: box.x0 - LINE_HALF, y0: box.y0 - LINE_HALF, x1: box.x1 + LINE_HALF, y1: box.y1 + LINE_HALF })) return false;
      if (filled) return !inside(b, box); // a label sitting fully inside a filled shape is fine
      return edges.some((s) => hit(b, s));
    },
  };
}

function pathPoints(d: string): { pts: [number, number][]; simple: boolean } {
  const nums = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  const simple = /^[MLCQZ\s\d.,eE+-]+$/.test(d);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return { pts, simple };
}

function obstacleFor(e: SceneElement): Obstacle[] {
  const m = e.motion;
  switch (e.type) {
    case "circle": {
      if (m?.type === "orbit") {
        const box = { x0: m.cx - m.radius, y0: m.cy - m.radius, x1: m.cx + m.radius, y1: m.cy + m.radius };
        return [{ desc: "an orbiting dot", test: (b) => hit(b, { x0: box.x0 - 8, y0: box.y0 - 8, x1: box.x1 + 8, y1: box.y1 + 8 }) && strips(box, 8).some((s) => hit(b, s)) }];
      }
      const filled = e.fill !== "none";
      const { cx, cy, r } = e;
      return [{
        desc: "a circle",
        test: (b) => {
          const nx = Math.max(b.x0, Math.min(cx, b.x1)), ny = Math.max(b.y0, Math.min(cy, b.y1));
          if (Math.hypot(nx - cx, ny - cy) > r + LINE_HALF) return false;
          const far = Math.max(...[[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
          if (filled) return far > r; // fully inside a filled circle is fine
          return far > r - LINE_HALF; // hollow: only the outline counts
        },
      }];
    }
    case "rect":
      return [hollowOrFilledBox("a box", rectBox(e.x, e.y, e.w, e.h), e.fill !== "none")];
    case "line":
    case "arrow": {
      const half = m?.type === "flow" ? 6 : LINE_HALF;
      return [polylineObstacle(e.type === "arrow" ? "an arrow" : "a line", [[e.x1, e.y1], [e.x2, e.y2]], half)];
    }
    case "path": {
      const { pts, simple } = pathPoints(e.d);
      if (!pts.length) return [];
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const bbox = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      if (simple) {
        const line = polylineObstacle("a curve", pts, m?.type === "flow" ? 6 : LINE_HALF);
        if (e.fill === "none") return [line];
        const fillBox = hollowOrFilledBox("a shape", bbox, true);
        return [line, fillBox];
      }
      return [hollowOrFilledBox("a curve", bbox, e.fill !== "none")];
    }
    default:
      return [];
  }
}

function walkTexts(els: SceneElement[], out: TextEl[] = []): TextEl[] {
  for (const e of els) {
    if (e.type === "text") out.push(e);
    else if (e.type === "group") walkTexts(e.children, out);
  }
  return out;
}
function walkShapes(els: SceneElement[], out: SceneElement[] = []): SceneElement[] {
  for (const e of els) {
    if (e.type === "group") walkShapes(e.children, out);
    else if (e.type !== "text") out.push(e);
  }
  return out;
}

function collisionsOf(t: TextEl, size: number, x: number, y: number, placed: TextEl[], obstacles: Obstacle[]): Collision[] {
  const found: Collision[] = [];
  const tb = textBox(t, size, x, y);
  const tightH = shrink(tb, 1);
  const tightS = shrink(tb, 2);
  for (const o of placed) {
    if (o === t) continue;
    if (hit(tightH, shrink(textBox(o), 1))) found.push({ kind: "hard", a: t.text, b: o.text });
  }
  for (const ob of obstacles) if (ob.test(tightS)) found.push({ kind: "soft", a: t.text, b: ob.desc });
  return found;
}

function candidates(): [number, number][] {
  const out: [number, number][] = [];
  for (let d = RING_STEP; d <= RING_MAX; d += RING_STEP) {
    out.push([0, d], [0, -d], [d, 0], [-d, 0], [d, d], [d, -d], [-d, d], [-d, -d]);
  }
  return out;
}

// Core pass over a mutable element tree. Returns unresolved collisions.
export function layoutElements(w: number, h: number, elements: SceneElement[]): Collision[] {
  const texts = walkTexts(elements);
  if (!texts.length) return [];
  const obstacles = walkShapes(elements).flatMap(obstacleFor);
  const order = texts.map((t, i) => ({ t, i })).sort((a, b) => a.t.step - b.t.step || a.i - b.i).map((o) => o.t);
  const placed: TextEl[] = [];
  const unresolved: Collision[] = [];
  const cand = candidates();

  for (const t of order) {
    // A label only competes with ones placed before it; later labels yield to this one.
    const initial = collisionsOf(t, t.size, t.x, t.y, placed, obstacles);
    if (initial.length) {
      const orig = textBox(t);
      const bounds: Box = {
        x0: Math.min(PAD, orig.x0), y0: Math.min(PAD, orig.y0),
        x1: Math.max(w - PAD, orig.x1), y1: Math.max(h - PAD, orig.y1),
      };
      let done = false;
      for (let size = t.size; size >= MIN_SIZE && !done; size = size > MIN_SIZE ? Math.max(MIN_SIZE, size - 2) : MIN_SIZE - 1) {
        // size shrink changes the extent; at unchanged size try the in-place spot only on shrunk sizes.
        const spots: [number, number][] = size === t.size ? cand : [[0, 0], ...cand];
        for (const [dx, dy] of spots) {
          const x = t.x + dx, y = t.y + dy;
          if (!inside(textBox(t, size, x, y), bounds)) continue;
          if (collisionsOf(t, size, x, y, placed, obstacles).length) continue;
          t.x = x; t.y = y; t.size = size;
          done = true;
          break;
        }
      }
      if (!done) unresolved.push(...initial);
    }
    placed.push(t);
  }
  return unresolved;
}

function cloneScene(scene: Scene): Scene {
  return JSON.parse(JSON.stringify(scene)) as Scene;
}

export function layoutScene(scene: Scene): { scene: Scene; unresolved: Collision[] } {
  const next = cloneScene(scene);
  const unresolved = layoutElements(next.w, next.h, next.elements);
  return { scene: next, unresolved };
}

export function resolveTextCollisions(scene: Scene): Scene {
  return layoutScene(scene).scene;
}

// Remaining collisions in a scene as-is (no changes made).
export function findTextCollisions(scene: Scene): Collision[] {
  const texts = walkTexts(scene.elements);
  const obstacles = walkShapes(scene.elements).flatMap(obstacleFor);
  const out: Collision[] = [];
  const seen: TextEl[] = [];
  for (const t of texts) {
    out.push(...collisionsOf(t, t.size, t.x, t.y, seen, obstacles));
    seen.push(t);
  }
  return out;
}
