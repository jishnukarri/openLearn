import { parseScene, type Scene } from "./lesson-scene";

// Built-in scenes for stored lessons that have no authored scene. Chosen by
// keyword on the section text only (no AI at view time); anything that does
// not clearly match returns null and the caller keeps its existing fallback.

function fieldLines(): Scene | null {
  const cx = 200, cy = 130;
  const els: unknown[] = [
    { type: "circle", cx, cy, r: 16, fill: "error", step: 0, enter: "scale", motion: { type: "pulse" } },
    { type: "text", x: cx, y: cy + 5, text: "+", size: 18, anchor: "middle", fill: "white", step: 0 },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * 20, y1 = cy + Math.sin(a) * 20;
    const x2 = cx + Math.cos(a) * 92, y2 = cy + Math.sin(a) * 92;
    els.push({
      type: "arrow", x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2),
      stroke: "primary", step: 1, enter: "draw",
      ...(i % 2 === 0 ? { motion: { type: "flow", dots: 2, duration: 3 } } : {}),
    });
  }
  els.push(
    { type: "circle", cx: 0, cy: 0, r: 7, fill: "success", step: 2, enter: "scale",
      motion: { type: "orbit", cx, cy, radius: 80, duration: 6 } },
    { type: "text", x: 200, y: 252, text: "Field lines point away from +", size: 16, anchor: "middle", step: 3 }
  );
  return parseScene({
    w: 400, h: 260,
    captions: [
      "A positive charge creates an electric field around it.",
      "Field lines point away from a positive charge, in the direction a positive test charge would be pushed.",
      "A small positive test charge feels a force along the field line.",
      "Lines closer together mean a stronger field, so the field is strongest near the charge.",
    ],
    elements: els,
  });
}

function velocityTime(): Scene | null {
  return parseScene({
    w: 400, h: 260,
    captions: [
      "A velocity-time graph has time along the bottom and velocity up the side.",
      "For constant acceleration the line is straight and slopes upwards.",
      "The gradient of the line is the acceleration.",
      "The area under the line is the distance travelled.",
    ],
    elements: [
      { type: "path", d: "M50 210 L300 210 L300 50 Z", fill: "light", stroke: "none", step: 3, enter: "fade" },
      { type: "arrow", x1: 50, y1: 210, x2: 370, y2: 210, stroke: "ink", step: 0, enter: "draw" },
      { type: "arrow", x1: 50, y1: 210, x2: 50, y2: 20, stroke: "ink", step: 0, enter: "draw" },
      { type: "text", x: 370, y: 232, text: "time (s)", size: 14, anchor: "end", step: 0 },
      { type: "text", x: 56, y: 24, text: "velocity (m/s)", size: 14, step: 0 },
      { type: "path", d: "M50 210 L300 50", stroke: "primary", step: 1, enter: "draw" },
      { type: "line", x1: 150, y1: 210, x2: 150, y2: 146, stroke: "secondary", dashed: true, step: 2, enter: "draw" },
      { type: "line", x1: 50, y1: 146, x2: 150, y2: 146, stroke: "secondary", dashed: true, step: 2, enter: "draw" },
      { type: "text", x: 160, y: 190, text: "gradient = acceleration", size: 14, fill: "secondary", step: 2 },
      { type: "text", x: 200, y: 200, text: "area = distance", size: 14, fill: "highlight", step: 3 },
    ],
  });
}

const LIBRARY: { test: RegExp; build: () => Scene | null }[] = [
  { test: /\b(electric )?field lines?\b/i, build: fieldLines },
  { test: /\b(velocity|speed)[ -]time (graph|plot)s?\b/i, build: velocityTime },
];

export function builtinSceneFor(heading: string, explanation: string): Scene | null {
  const text = `${heading}\n${explanation}`;
  for (const entry of LIBRARY) if (entry.test.test(text)) return entry.build();
  return null;
}
