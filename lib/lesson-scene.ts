// Declarative animated scenes for worked examples. The model writes plain
// JSON (no markup, no colours outside a fixed palette); parseScene() turns
// untrusted input into a clamped, safe Scene or null. Rendering lives in
// components/lesson-scene.tsx. Pure module: safe on server and client.

export const PALETTE = {
  ink: "#1a1512",
  muted: "#5f564b",
  primary: "#534fe0",
  secondary: "#c94a34",
  highlight: "#926006",
  success: "#1a8048",
  error: "#cc3333",
  light: "#e7e0d8",
  white: "#ffffff",
  none: "none",
} as const;
export type PaletteName = keyof typeof PALETTE;

export const ENTERS = ["fade", "draw", "scale", "slide"] as const;
export type Enter = (typeof ENTERS)[number];

export type Motion =
  | { type: "pulse" }
  | { type: "orbit"; cx: number; cy: number; radius: number; duration: number }
  | { type: "flow"; dots: number; duration: number }
  | { type: "oscillate"; axis: "x" | "y"; amount: number; duration: number };

type Base = { step: number; enter: Enter; motion?: Motion };
export type SceneElement = Base &
  (
    | { type: "circle"; cx: number; cy: number; r: number; fill: PaletteName; stroke: PaletteName }
    | { type: "rect"; x: number; y: number; w: number; h: number; rx: number; fill: PaletteName; stroke: PaletteName }
    | { type: "line" | "arrow"; x1: number; y1: number; x2: number; y2: number; stroke: PaletteName; dashed: boolean }
    | { type: "path"; d: string; fill: PaletteName; stroke: PaletteName; dashed: boolean }
    | { type: "text"; x: number; y: number; text: string; size: number; anchor: "start" | "middle" | "end"; fill: PaletteName }
    | { type: "group"; children: SceneElement[] }
  );

export type Scene = {
  w: number;
  h: number;
  // viewBox may be larger than w/h so wide labels are never clipped.
  viewBox: [number, number, number, number];
  captions: string[]; // one per step; steps = captions.length
  elements: SceneElement[];
};

export const MAX_ELEMENTS = 60;
export const MAX_STEPS = 6;
const MAX_TEXT = 80;
const MAX_PATH = 400;
const PATH_OK = /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,eE+-]+$/;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function n(v: unknown, lo: number, hi: number, fallback: number): number {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, x));
}
const COORD_LO = -100;
const COORD_HI = 1100;
const coord = (v: unknown, fb = 0) => n(v, COORD_LO, COORD_HI, fb);

function color(v: unknown, fallback: PaletteName): PaletteName {
  return typeof v === "string" && v in PALETTE ? (v as PaletteName) : fallback;
}

export function estimateTextWidth(text: string, size: number): number {
  return text.length * size * 0.58;
}

function parseMotion(raw: unknown, type: string): Motion | undefined {
  if (!isObj(raw)) return undefined;
  switch (raw.type) {
    case "pulse":
      return { type: "pulse" };
    case "oscillate":
      return {
        type: "oscillate",
        axis: raw.axis === "y" ? "y" : "x",
        amount: n(raw.amount, 2, 80, 12),
        duration: n(raw.duration, 0.6, 12, 2.4),
      };
    case "flow":
      return type === "line" || type === "arrow" || type === "path"
        ? { type: "flow", dots: Math.round(n(raw.dots, 1, 6, 3)), duration: n(raw.duration, 0.8, 14, 3.5) }
        : undefined;
    case "orbit":
      return type === "circle"
        ? {
            type: "orbit",
            cx: coord(raw.cx),
            cy: coord(raw.cy),
            radius: n(raw.radius, 4, 600, 40),
            duration: n(raw.duration, 1, 20, 5),
          }
        : undefined;
    default:
      return undefined;
  }
}

function parseElement(raw: unknown, steps: number, inGroup: boolean): SceneElement | null {
  if (!isObj(raw) || typeof raw.type !== "string") return null;
  const t = raw.type;
  const base: Base = {
    step: Math.round(n(raw.step, 0, steps - 1, 0)),
    enter: (ENTERS as readonly string[]).includes(raw.enter as string) ? (raw.enter as Enter) : "fade",
    motion: parseMotion(raw.motion, t),
  };
  switch (t) {
    case "circle":
      return {
        ...base, type: "circle", cx: coord(raw.cx), cy: coord(raw.cy), r: n(raw.r, 1, 300, 10),
        fill: color(raw.fill, "none"), stroke: color(raw.stroke, "none"),
      };
    case "rect":
      return {
        ...base, type: "rect", x: coord(raw.x), y: coord(raw.y), w: n(raw.w, 1, 1200, 40), h: n(raw.h, 1, 1200, 30),
        rx: n(raw.rx, 0, 60, 0), fill: color(raw.fill, "none"), stroke: color(raw.stroke, "none"),
      };
    case "line":
    case "arrow":
      return {
        ...base, type: t, x1: coord(raw.x1), y1: coord(raw.y1), x2: coord(raw.x2), y2: coord(raw.y2),
        stroke: color(raw.stroke, "ink"), dashed: raw.dashed === true,
      };
    case "path": {
      const d = typeof raw.d === "string" ? raw.d.trim() : "";
      if (!d || d.length > MAX_PATH || !PATH_OK.test(d) || !/^[Mm]/.test(d)) return null;
      return {
        ...base, type: "path", d, fill: color(raw.fill, "none"), stroke: color(raw.stroke, "ink"),
        dashed: raw.dashed === true,
      };
    }
    case "text": {
      const text = typeof raw.text === "string" ? raw.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
      if (!text) return null;
      const anchor = raw.anchor === "middle" || raw.anchor === "end" ? raw.anchor : "start";
      return {
        ...base, type: "text", x: coord(raw.x), y: coord(raw.y), text, size: n(raw.size, 12, 32, 14),
        anchor, fill: color(raw.fill, "ink"),
      };
    }
    case "group": {
      if (inGroup || !Array.isArray(raw.children)) return null;
      const children = raw.children
        .slice(0, MAX_ELEMENTS)
        .map((c) => parseElement(c, steps, true))
        .filter((c): c is SceneElement => !!c);
      if (!children.length) return null;
      // Group-level motion: only pulse/oscillate make sense on a group.
      const m = base.motion;
      return { ...base, motion: m && (m.type === "pulse" || m.type === "oscillate") ? m : undefined, type: "group", children };
    }
    default:
      return null;
  }
}

export function countElements(els: SceneElement[]): number {
  return els.reduce((a, e) => a + 1 + (e.type === "group" ? countElements(e.children) : 0), 0);
}

// Trim a list to at most `max` elements in total (groups count their children).
function clampCount(els: SceneElement[], max: number): SceneElement[] {
  const out: SceneElement[] = [];
  let used = 0;
  for (const e of els) {
    if (e.type === "group") {
      const room = max - used - 1;
      if (room < 1) break;
      const children = clampCount(e.children, room);
      if (!children.length) continue;
      out.push({ ...e, children });
      used += 1 + countElements(children);
    } else {
      if (used + 1 > max) break;
      out.push(e);
      used += 1;
    }
  }
  return out;
}

function flatten(els: SceneElement[]): SceneElement[] {
  return els.flatMap((e) => (e.type === "group" ? [e, ...flatten(e.children)] : [e]));
}

// Validates and clamps untrusted scene JSON. Returns null when it is not
// usable (not an object, no captions, nothing drawable).
export function parseScene(raw: unknown): Scene | null {
  if (!isObj(raw)) return null;
  const captions = (Array.isArray(raw.captions) ? raw.captions : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.replace(/\s+/g, " ").trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, MAX_STEPS);
  if (!captions.length) return null;
  const steps = captions.length;
  const w = Math.round(n(raw.w, 200, 800, 400));
  const h = Math.round(n(raw.h, 120, 600, 260));
  if (!Array.isArray(raw.elements)) return null;
  const parsed = raw.elements
    .slice(0, MAX_ELEMENTS * 2)
    .map((e) => parseElement(e, steps, false))
    .filter((e): e is SceneElement => !!e);
  const elements = clampCount(parsed, MAX_ELEMENTS);
  if (!elements.length) return null;

  // Grow the viewBox to contain text that would run past the canvas.
  let lo = 0, top = 0, hi = w, bottom = h;
  for (const e of flatten(elements)) {
    if (e.type !== "text") continue;
    const width = estimateTextWidth(e.text, e.size);
    const left = e.anchor === "middle" ? e.x - width / 2 : e.anchor === "end" ? e.x - width : e.x;
    lo = Math.min(lo, left);
    hi = Math.max(hi, left + width);
    top = Math.min(top, e.y - e.size);
    bottom = Math.max(bottom, e.y + e.size * 0.4);
  }
  const pad = 6;
  if (lo < 0) lo -= pad;
  if (hi > w) hi += pad;
  if (top < 0) top -= pad;
  if (bottom > h) bottom += pad;
  const r = (x: number) => Math.round(x);
  return {
    w, h, captions, elements,
    viewBox: [r(lo), r(top), Math.min(r(hi - lo), 1600), Math.min(r(bottom - top), 1200)],
  };
}

export function sceneStepCount(scene: Scene): number {
  return scene.captions.length;
}

// Elements visible at a step (flat top level; groups carry their children).
export function visibleElements(scene: Scene, step: number): SceneElement[] {
  return scene.elements.filter((e) => e.step <= step);
}

// Serialisable form for storage: parseScene(x) output is already plain JSON.
export function cleanStoredScene(raw: unknown): Scene | null {
  return parseScene(raw);
}
