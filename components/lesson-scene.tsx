"use client";

import { StepNarration } from "@/components/step-narration";
import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { PALETTE, type Scene, type SceneElement } from "@/lib/lesson-scene";

const STEP_MS = 4200;

const controlClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40";

const colour = (name: keyof typeof PALETTE) => PALETTE[name];

// Entrance props shared by every element. `animated` is false under
// reduced motion: elements simply appear in their final state.
function enterProps(el: SceneElement, animated: boolean) {
  if (!animated) return { initial: false as const };
  const transition = { duration: 0.6, ease: EASE_OUT };
  switch (el.enter) {
    case "scale":
      return { initial: { opacity: 0, scale: 0.2 }, animate: { opacity: 1, scale: 1 }, transition };
    case "slide":
      return { initial: { opacity: 0, x: -28 }, animate: { opacity: 1, x: 0 }, transition };
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition };
  }
}

// Dots travelling along a path (field lines, current, orbits). Uses CSS
// offset-path so framer only animates offset-distance.
function Riders({
  d, count, duration, fill, r = 3.2, loop = true,
}: { d: string; count: number; duration: number; fill: string; r?: number; loop?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <motion.circle
          key={i}
          cx={0}
          cy={0}
          r={r}
          fill={fill}
          style={{ offsetPath: `path("${d}")`, offsetRotate: "0deg" }}
          initial={{ offsetDistance: "0%", opacity: 0 }}
          animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{
            duration,
            ease: "linear",
            repeat: loop ? Infinity : 0,
            delay: (i * duration) / count,
          }}
        />
      ))}
    </>
  );
}

function arrowHead(x1: number, y1: number, x2: number, y2: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = 10, W = 0.45;
  const p = (ang: number) => `${(x2 - Math.cos(ang) * L).toFixed(1)},${(y2 - Math.sin(ang) * L).toFixed(1)}`;
  return `${x2},${y2} ${p(a - W)} ${p(a + W)}`;
}

function Shape({ el, animated }: { el: SceneElement; animated: boolean }) {
  const e = enterProps(el, animated);
  const loop = animated ? el.motion : undefined;
  const draw = animated && el.enter === "draw";
  const drawProps = draw
    ? {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { duration: 0.9, ease: EASE_OUT },
      }
    : e;

  switch (el.type) {
    case "circle": {
      if (loop?.type === "orbit") {
        const d = `M${loop.cx - loop.radius} ${loop.cy} a${loop.radius} ${loop.radius} 0 1 0 ${loop.radius * 2} 0 a${loop.radius} ${loop.radius} 0 1 0 ${-loop.radius * 2} 0`;
        return (
          <motion.g {...e}>
            <Riders d={d} count={1} duration={loop.duration} fill={colour(el.fill)} r={el.r} />
          </motion.g>
        );
      }
      const pulse = loop?.type === "pulse";
      return (
        <motion.circle
          cx={el.cx} cy={el.cy} r={el.r}
          fill={colour(el.fill)} stroke={colour(el.stroke)} strokeWidth={2}
          {...e}
          {...(pulse ? { animate: { r: [el.r, el.r * 1.18, el.r], opacity: 1 }, transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } } : {})}
        />
      );
    }
    case "rect":
      return (
        <motion.rect
          x={el.x} y={el.y} width={el.w} height={el.h} rx={el.rx}
          fill={colour(el.fill)} stroke={colour(el.stroke)} strokeWidth={2}
          {...e}
        />
      );
    case "line":
    case "arrow": {
      const d = `M${el.x1} ${el.y1} L${el.x2} ${el.y2}`;
      return (
        <motion.g {...(draw ? { initial: { opacity: 1 } } : e)}>
          <motion.line
            x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
            stroke={colour(el.stroke)} strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray={el.dashed ? "6 5" : undefined}
            {...drawProps}
          />
          {el.type === "arrow" && (
            <motion.polygon
              points={arrowHead(el.x1, el.y1, el.x2, el.y2)}
              fill={colour(el.stroke)}
              initial={animated ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: draw ? 0.7 : 0.1 }}
            />
          )}
          {loop?.type === "flow" && (
            <Riders d={d} count={loop.dots} duration={loop.duration} fill={colour(el.stroke)} />
          )}
        </motion.g>
      );
    }
    case "path":
      return (
        <motion.g {...(draw ? { initial: { opacity: 1 } } : e)}>
          <motion.path
            d={el.d} fill={colour(el.fill)} stroke={colour(el.stroke)} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={el.dashed ? "6 5" : undefined}
            {...drawProps}
          />
          {loop?.type === "flow" && (
            <Riders d={el.d} count={loop.dots} duration={loop.duration} fill={colour(el.stroke === "none" ? "primary" : el.stroke)} />
          )}
        </motion.g>
      );
    case "text":
      return (
        <motion.text
          x={el.x} y={el.y} fontSize={el.size} textAnchor={el.anchor}
          fill={colour(el.fill)} fontWeight={600}
          {...e}
        >
          {el.text}
        </motion.text>
      );
    case "group": {
      let wrapper: Record<string, unknown> = {};
      if (loop?.type === "oscillate") {
        const k = loop.axis;
        wrapper = { animate: { [k]: [-loop.amount, loop.amount, -loop.amount], opacity: 1 }, transition: { duration: loop.duration, repeat: Infinity, ease: "easeInOut" } };
      } else if (loop?.type === "pulse") {
        wrapper = { animate: { opacity: [1, 0.55, 1] }, transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } };
      }
      return (
        <motion.g {...e} {...wrapper}>
          {el.children.map((c, i) => (
            <Shape key={i} el={c} animated={animated} />
          ))}
        </motion.g>
      );
    }
  }
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="lesson-figure"><div className="lesson-panel">{children}</div></div>;
}

// Animated, stepped scene on a white panel. Reduced motion shows the final,
// complete state and never loops. Arrow keys step; captions are announced.
export function LessonScene({ scene, label = "Worked example animation" }: { scene: Scene; label?: string }) {
  const reduce = !!useReducedMotion();
  const total = scene.captions.length;
  const [index, setIndex] = useState(reduce ? total - 1 : 0);
  const [playing, setPlaying] = useState(!reduce && total > 1);
  const [run, setRun] = useState(0); // bumps on replay to remount elements

  // "playing" past the last step is just finished: derive it, don't set state in an effect.
  const running = playing && index < total - 1;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIndex((i) => Math.min(total - 1, i + 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [running, index, total]);

  const go = useCallback(
    (to: number) => {
      setPlaying(false);
      setIndex(Math.max(0, Math.min(total - 1, to)));
    },
    [total]
  );
  const replay = () => {
    setRun((r) => r + 1);
    setIndex(0);
    setPlaying(total > 1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  };

  const shownStep = reduce ? total - 1 : index;
  const atEnd = index >= total - 1;
  const [vx, vy, vw, vh] = scene.viewBox;

  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <Panel>
        <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} role="img" aria-label={scene.captions[shownStep]} style={{ width: "100%", height: "auto", maxHeight: "28rem", overflow: "visible", display: "block" }}>
          {scene.elements.map((el, i) =>
            el.step < shownStep || (reduce && el.step <= shownStep) ? <Shape key={`${run}-${i}`} el={el} animated={!reduce} /> : el.step === shownStep ? (
              <motion.g key={`${run}-${i}-${shownStep}`} animate={reduce ? undefined : { opacity: [1, 0.55, 1] }} transition={{ duration: 1.2, ease: "easeInOut", times: [0, 0.5, 1], delay: 0.5 }}>
                <Shape el={el} animated={!reduce} />
              </motion.g>
            ) : null
          )}
        </svg>
      </Panel>

      <StepNarration steps={scene.captions} index={shownStep} />

      {total > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {!reduce && (
            <>
              <button type="button" className={controlClass} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
                <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
              {atEnd ? (
                <button type="button" className={controlClass} onClick={replay}>
                  <RotateCcw className="size-4" strokeWidth={2} aria-hidden="true" /> Replay
                </button>
              ) : (
                <button type="button" className={controlClass} onClick={() => (index >= total - 1 ? replay() : setPlaying((p) => !p))}>
                  {running ? <Pause className="size-4" strokeWidth={2} aria-hidden="true" /> : <Play className="size-4" strokeWidth={2} aria-hidden="true" />}
                  {running ? "Pause" : "Play"}
                </button>
              )}
              <button type="button" className={controlClass} onClick={() => go(index + 1)} disabled={atEnd} aria-label="Next step">
                <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </>
          )}
          <div className="flex items-center" role="group" aria-label="Steps">
            {scene.captions.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Step ${i + 1}`}
                aria-current={i === shownStep ? "step" : undefined}
                className="flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className={`block size-2.5 rounded-full ${i === shownStep ? "bg-primary" : "bg-border"}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
