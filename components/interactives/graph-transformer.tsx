"use client";

import { useState } from "react";
import type { InteractiveGraph } from "@/lib/ai/lessons";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { collapseRepeatedChars, shortTakeaway } from "@/lib/text-sanitize";

// SVG viewport constants
const W = 380;
const H = 260;
const PAD = 30;
const RANGE = 6; // x and y go from -RANGE to +RANGE

function toSvgX(x: number) {
  return PAD + ((x + RANGE) / (2 * RANGE)) * (W - 2 * PAD);
}
function toSvgY(y: number) {
  return H - PAD - ((y + RANGE) / (2 * RANGE)) * (H - 2 * PAD);
}

function computePoints(curveType: InteractiveGraph["curveType"], params: number[]): [number, number][] {
  const pts: [number, number][] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const x = -RANGE + (2 * RANGE * i) / steps;
    let y = 0;
    const a = params[0] ?? 1;
    const b = params[1] ?? 0;
    switch (curveType) {
      case "parabola":   y = a * x * x + b; break;
      case "line":       y = a * x + b; break;
      case "sine":       y = a * Math.sin(b !== 0 ? b * x : x); break;
      case "exponential": y = a * Math.exp(b !== 0 ? b * x : x * 0.5); break;
    }
    if (Math.abs(y) <= RANGE * 2) pts.push([x, Math.max(-RANGE, Math.min(RANGE, y))]);
    else if (pts.length > 0) pts.push([NaN, NaN]); // break path
  }
  return pts;
}

function pointsToPath(pts: [number, number][]): string {
  let d = "";
  let penDown = false;
  for (const [x, y] of pts) {
    if (isNaN(x)) { penDown = false; continue; }
    const sx = toSvgX(x);
    const sy = toSvgY(y);
    if (!penDown) { d += `M ${sx} ${sy} `; penDown = true; }
    else d += `L ${sx} ${sy} `;
  }
  return d;
}

export function GraphTransformer({ interactive, onContinue }: { interactive: InteractiveGraph; onContinue: () => void }) {
  const params = interactive.params ?? [];
  const observations = interactive.observations ?? [];
  const [values, setValues] = useState(() => params.map((p) => p.default));
  const [interacted, setInteracted] = useState(false);
  const [showCodify, setShowCodify] = useState(false);
  const [obsIdx, setObsIdx] = useState(0);

  const pts = computePoints(interactive.curveType, values);
  const pathD = pointsToPath(pts);

  function handleParam(i: number, v: number) {
    const next = [...values];
    next[i] = v;
    setValues(next);
    if (!interacted) setInteracted(true);
    // cycle through observations
    if (interacted && observations.length > 0) setObsIdx((o) => (o + 1) % observations.length);
  }

  // Axis ticks
  const ticks = [-4, -2, 0, 2, 4];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          {collapseRepeatedChars(interactive.title)}
        </h3>
        <p className="text-sm text-muted">Adjust the sliders and watch the curve transform.</p>
      </div>

      {/* SVG graph */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Interactive graph">
          {/* Grid */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={toSvgX(t)} y1={PAD} x2={toSvgX(t)} y2={H - PAD} stroke="var(--color-border)" strokeWidth={1} />
              <line x1={PAD} y1={toSvgY(t)} x2={W - PAD} y2={toSvgY(t)} stroke="var(--color-border)" strokeWidth={1} />
            </g>
          ))}
          {/* Axes */}
          <line x1={toSvgX(0)} y1={PAD} x2={toSvgX(0)} y2={H - PAD} stroke="var(--color-muted)" strokeWidth={1.5} />
          <line x1={PAD} y1={toSvgY(0)} x2={W - PAD} y2={toSvgY(0)} stroke="var(--color-muted)" strokeWidth={1.5} />
          {/* Axis labels */}
          <text x={W - PAD + 4} y={toSvgY(0) + 4} fontSize={11} fill="var(--color-muted)">x</text>
          <text x={toSvgX(0) + 4} y={PAD - 4} fontSize={11} fill="var(--color-muted)">y</text>
          {/* Curve */}
          {pathD && (
            <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </div>

      {/* Param sliders */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        {params.map((p, i) => (
          <div key={p.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">{p.label}</label>
              <span className="font-[family-name:var(--font-mono)] text-sm text-primary">
                {values[i] > 0 ? `+${values[i]}` : values[i]}
              </span>
            </div>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={values[i]}
              onChange={(e) => handleParam(i, Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="flex justify-between text-3xs text-muted">
              <span>{p.min}</span>
              <span>0</span>
              <span>+{p.max}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Observations */}
      {interacted && observations.length > 0 && (
        <div className="animate-fade-slide-up rounded-xl border border-primary/25 bg-primary/8 px-4 py-3">
          <p className="text-xs font-semibold text-primary mb-1">Notice</p>
          <p className="text-sm text-foreground">
            <RichText text={observations[obsIdx % observations.length]} />
          </p>
        </div>
      )}

      {!interacted && (
        <p className="text-center text-xs text-muted">Drag the sliders to explore →</p>
      )}

      {showCodify ? (
        <div className="animate-fade-slide-up flex flex-col gap-3 rounded-xl border border-success/30 bg-success/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-success">What you just discovered</p>
          <p className="text-sm text-foreground"><RichText text={shortTakeaway(interactive.codify)} /></p>
          <Button onClick={onContinue} className="self-start">Start the lesson →</Button>
        </div>
      ) : interacted ? (
        <button
          type="button"
          onClick={() => setShowCodify(true)}
          className="self-center text-sm font-medium text-primary hover:underline"
        >
          What does this show? →
        </button>
      ) : null}
    </div>
  );
}
