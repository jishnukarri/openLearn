"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { InteractiveSliderSim } from "@/lib/ai/lessons";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { EASE_OUT } from "@/components/motion";
import { collapseRepeatedChars } from "@/lib/text-sanitize";

const TRAVEL_S = 1.4;
const DWELL_MS = 3200;

// Cause-and-effect played as a short animation: the variable sweeps from
// low to high, stopping on each outcome zone long enough to read what it
// causes, then lands on the explanation. Students watch, but can pause,
// replay or tap a zone to jump there.
export function SliderSim({ interactive, onContinue }: { interactive: InteractiveSliderSim; onContinue: () => void }) {
  // Outcome bands are thresholds on the first slider only.
  const slider = (interactive.sliders ?? [])[0];
  const outcomes = interactive.outcomes ?? [];
  const reduce = useReducedMotion();

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const p = useMotionValue(0);
  const fill = useTransform(p, (v) => `${v}%`);
  const [display, setDisplay] = useState(slider?.min ?? 0);
  const anim = useRef<ReturnType<typeof animate> | null>(null);

  const mid = (i: number) => {
    const o = outcomes[i];
    return (Math.max(0, o.minThreshold) + Math.min(100, o.maxThreshold)) / 2;
  };

  useEffect(() => {
    if (!slider) return;
    return p.on("change", (v) => {
      const raw = slider.min + (v / 100) * (slider.max - slider.min);
      const step = slider.step || 1;
      setDisplay(Number((Math.round(raw / step) * step).toFixed(2)));
    });
  }, [p, slider]);

  // Move to the current zone, then (while playing) dwell and advance.
  useEffect(() => {
    if (!outcomes.length) return;
    anim.current?.stop();
    anim.current = animate(p, mid(idx), { duration: reduce ? 0 : TRAVEL_S, ease: EASE_OUT });
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (idx < outcomes.length - 1) setIdx(idx + 1);
      else {
        setPlaying(false);
        setFinished(true);
      }
    }, (reduce ? 0 : TRAVEL_S * 1000) + DWELL_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, playing, outcomes.length, reduce]);

  if (!slider || outcomes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-muted">This activity didn&apos;t generate properly.</p>
        <Button onClick={onContinue} variant="secondary" size="compact">
          Skip to the lesson →
        </Button>
      </div>
    );
  }

  const outcome = outcomes[idx];

  function replay() {
    p.set(0);
    setFinished(false);
    setIdx(0);
    setPlaying(true);
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-7 sm:gap-8">
        <div className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground lg:text-3xl">
            {collapseRepeatedChars(interactive.title)}
          </h3>
          <p className="max-w-[60ch] text-base text-muted">{interactive.description}</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <p className="text-base font-semibold text-foreground">{slider.label}</p>
            <p className="font-[family-name:var(--font-mono)] text-3xl font-semibold tabular-nums text-primary">
              {display}
              <span className="ml-1 text-lg text-muted">{slider.unit}</span>
            </p>
          </div>

          {/* Read-only track driven by the animation. */}
          <div
            role="meter"
            aria-label={slider.label}
            aria-valuemin={slider.min}
            aria-valuemax={slider.max}
            aria-valuenow={display}
            className="relative h-3 rounded-full bg-border"
          >
            <motion.div style={{ width: fill }} className="absolute inset-y-0 left-0 rounded-full bg-primary" />
            <motion.span
              style={{ left: fill }}
              className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-primary shadow-[0_2px_8px_-2px_var(--primary)]"
            />
          </div>

          <div className="flex gap-1.5" role="tablist" aria-label="Outcomes">
            {outcomes.map((o, oi) => {
              const width = Math.max(1, Math.min(100, o.maxThreshold) - Math.max(0, o.minThreshold));
              const active = oi === idx;
              const seen = oi < idx || finished;
              return (
                <button
                  key={oi}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setPlaying(false);
                    setIdx(oi);
                  }}
                  style={{ flexGrow: width, flexBasis: 0 }}
                  className={`relative min-h-12 min-w-0 overflow-hidden rounded-lg px-2 py-2 text-center text-sm font-medium leading-tight transition-colors duration-200 ${
                    active
                      ? "bg-primary text-white"
                      : seen
                        ? "bg-primary/15 text-foreground hover:bg-primary/25"
                        : "bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {active && playing && !reduce && (
                    <motion.span
                      key={`t-${idx}`}
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-1 origin-left bg-white/50"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: TRAVEL_S + DWELL_MS / 1000, ease: "linear" }}
                    />
                  )}
                  <span className="line-clamp-2">{o.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between text-sm text-muted">
            <span>{slider.min} {slider.unit}</span>
            <span>{slider.max} {slider.unit}</span>
          </div>
        </div>

        <div className="min-h-[8.5rem] sm:min-h-[7rem]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-col gap-2"
            >
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">{outcome.label}</p>
              <p className="max-w-[60ch] text-base leading-relaxed text-foreground">
                <RichText text={outcome.description} />
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {finished ? (
            <Button size="compact" variant="secondary" className="!shadow-none" onClick={replay}>
              <RotateCcw className="mr-2 size-4" strokeWidth={2} /> Replay
            </Button>
          ) : (
            <Button size="compact" variant="secondary" className="!shadow-none" onClick={() => setPlaying((v) => !v)}>
              {playing ? <Pause className="mr-2 size-4" strokeWidth={2} /> : <Play className="mr-2 size-4" strokeWidth={2} />}
              {playing ? "Pause" : "Play"}
            </Button>
          )}
          {!finished && (
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setFinished(true);
                setIdx(outcomes.length - 1);
              }}
              className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Skip to the explanation
            </button>
          )}
        </div>

        <AnimatePresence>
          {finished && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="flex flex-col gap-4 border-t border-border pt-6"
            >
              <h4 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">What this means</h4>
              <p className="max-w-[60ch] text-base leading-relaxed text-foreground">
                <RichText text={interactive.codify} />
              </p>
              <Button onClick={onContinue} className="w-full self-start sm:w-auto">
                Start the lesson →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
