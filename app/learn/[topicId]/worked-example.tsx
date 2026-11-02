"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import type { LessonVisual as Visual } from "@/lib/ai/lessons";
import { EASE_OUT } from "@/components/motion";
import { LessonVisual } from "./lesson-visual";
import { WatchLabel } from "./lesson-parts";
import { StepNarration } from "@/components/step-narration";
import { LessonScene } from "@/components/lesson-scene";
import type { Scene } from "@/lib/lesson-scene";

const STEP_MS = 3800;

const controlClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40";

// A worked example as a stepped, animated visual: the image or diagram when
// there is one, with the steps revealing one by one as highlighted callouts.
// Reduced motion shows every step at once. A missing or failed image falls
// drops the visual block entirely, so the steps are the whole example.
export function WorkedExample({
  steps,
  visual,
  scene,
}: {
  steps: string[];
  visual?: Visual | null;
  scene?: Scene | null;
}) {
  if (scene) {
    return (
      <div className="animate-fade-slide-up">
        <WatchLabel />
        <LessonScene scene={scene} />
      </div>
    );
  }
  return <SteppedExample steps={steps} visual={visual} />;
}

function SteppedExample({ steps, visual }: { steps: string[]; visual?: Visual | null }) {
  const reduce = !!useReducedMotion();
  const total = steps.length;
  const [index, setIndex] = useState(reduce ? total - 1 : 0);
  const [playing, setPlaying] = useState(!reduce && total > 1);
  const [imageState, setImageState] = useState<"loading" | "ok" | "failed">("loading");

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
    setIndex(0);
    setPlaying(total > 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  };

  const atEnd = index >= total - 1;

  const hasImage = visual?.kind === "image" && !!visual.url && imageState !== "failed";
  const hasMarkup = visual?.kind === "svg" || visual?.kind === "html";
  const showFrame = !hasImage && !hasMarkup;

  return (
    <div
      role="group"
      aria-label="Worked example, step by step"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="animate-fade-slide-up rounded-xl border border-border bg-surface p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <WatchLabel>{showFrame ? "Worked example" : undefined}</WatchLabel>

      {visual?.kind === "image" && visual.url && imageState !== "failed" && (
        <figure className="relative mb-4 overflow-hidden rounded-lg bg-background">
          {imageState === "loading" && (
            <div className="aspect-video w-full animate-pulse bg-border/50" aria-hidden="true" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- AI image with unknown dimensions */}
          <img
            src={visual.url}
            alt={visual.alt}
            onLoad={() => setImageState("ok")}
            onError={() => setImageState("failed")}
            className={imageState === "loading" ? "absolute inset-0 size-full opacity-0" : "block h-auto w-full"}
          />
        </figure>
      )}

      {hasMarkup && (
        <motion.div
          key={reduce ? "static" : index}
          initial={reduce ? false : { opacity: 0.6, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="mb-4 rounded-lg bg-background p-3"
        >
          <LessonVisual visual={visual} />
        </motion.div>
      )}

      <StepNarration steps={steps} index={index} large={showFrame} />

      {!reduce && total > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
