"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import type { InteractiveSliderSim } from "@/lib/ai/lessons";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { EASE_OUT } from "@/components/motion";
import { collapseRepeatedChars } from "@/lib/text-sanitize";

function pct(value: number, min: number, max: number) {
  return max === min ? 0 : ((value - min) / (max - min)) * 100;
}

// Explore-first slider: the band under the slider maps every outcome zone,
// so moving the slider is a hunt ("what's over here?") instead of a text
// swap. The explanation unlocks once the student has found a contrast.
export function SliderSim({ interactive, onContinue }: { interactive: InteractiveSliderSim; onContinue: () => void }) {
  // Outcome bands are thresholds on the first slider only, so any extra
  // slider an older lesson generated would move nothing; show just the one.
  const sliders = (interactive.sliders ?? []).slice(0, 1);
  const outcomes = interactive.outcomes ?? [];
  const [values, setValues] = useState(() => sliders.map((s) => s.default));
  const [found, setFound] = useState<Set<number>>(() => new Set());
  const [showCodify, setShowCodify] = useState(false);

  const primary = sliders[0];
  const p = primary ? pct(values[0], primary.min, primary.max) : 0;
  const outcomeIdx = outcomes.length
    ? Math.max(0, outcomes.findIndex((o) => p >= o.minThreshold && p <= o.maxThreshold))
    : -1;
  const outcome = outcomeIdx >= 0 ? outcomes[outcomeIdx] : null;
  const needed = Math.min(2, outcomes.length);
  const unlocked = found.size >= needed;

  function handleSlider(i: number, v: number) {
    const next = [...values];
    next[i] = v;
    setValues(next);
    if (i === 0 && primary && outcomes.length) {
      const np = pct(v, primary.min, primary.max);
      const idx = outcomes.findIndex((o) => np >= o.minThreshold && np <= o.maxThreshold);
      if (idx >= 0) setFound((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
    }
  }

  if (sliders.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-muted">This activity didn&apos;t generate properly.</p>
        <Button onClick={onContinue} variant="secondary" size="compact">
          Skip to the lesson →
        </Button>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground lg:text-3xl">
            {collapseRepeatedChars(interactive.title)}
          </h3>
          <p className="max-w-[60ch] text-base text-muted">{interactive.description}</p>
        </div>

        {sliders.map((slider, i) => {
          const sp = pct(values[i], slider.min, slider.max);
          return (
            <div key={slider.id} className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <label htmlFor={`sim-${slider.id}`} className="text-base font-semibold text-foreground">
                  {slider.label}
                </label>
                <motion.span
                  key={values[i]}
                  initial={{ opacity: 0.4, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="font-[family-name:var(--font-mono)] text-3xl font-semibold tabular-nums text-primary"
                >
                  {values[i]}
                  <span className="ml-1 text-lg text-muted">{slider.unit}</span>
                </motion.span>
              </div>

              <input
                id={`sim-${slider.id}`}
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={values[i]}
                onChange={(e) => handleSlider(i, Number(e.target.value))}
                className="h-3 w-full cursor-pointer accent-[var(--color-primary)]"
              />

              {i === 0 && outcomes.length > 0 && (
                <div className="relative">
                  <div className="flex h-12 overflow-hidden rounded-xl border border-border">
                    {outcomes.map((o, oi) => {
                      const width = Math.max(0, Math.min(100, o.maxThreshold) - Math.max(0, o.minThreshold));
                      const active = oi === outcomeIdx;
                      const seen = found.has(oi);
                      return (
                        <div
                          key={oi}
                          style={{ width: `${width}%` }}
                          className={`flex items-center justify-center border-r border-border px-2 text-center text-sm font-medium transition-colors duration-200 last:border-r-0 ${
                            active
                              ? "bg-primary text-white"
                              : seen
                                ? "bg-primary/15 text-foreground"
                                : "bg-surface text-muted"
                          }`}
                        >
                          <span className="truncate">{seen || active ? o.label : "?"}</span>
                        </div>
                      );
                    })}
                  </div>
                  <motion.span
                    aria-hidden
                    className="absolute -top-2 h-16 w-0.5 rounded-full bg-foreground"
                    animate={{ left: `${sp}%` }}
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                  />
                </div>
              )}

              <div className="flex justify-between text-sm text-muted">
                <span>{slider.min} {slider.unit}</span>
                <span>{slider.max} {slider.unit}</span>
              </div>
            </div>
          );
        })}

        <div className="min-h-[7rem]">
          <AnimatePresence mode="wait" initial={false}>
            {found.size > 0 && outcome ? (
              <motion.div
                key={outcomeIdx}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
                className="flex flex-col gap-2"
              >
                <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                  {outcome.label}
                </p>
                <p className="max-w-[60ch] text-base leading-relaxed text-foreground">
                  <RichText text={outcome.description} />
                </p>
              </motion.div>
            ) : (
              <motion.p key="hint" exit={{ opacity: 0 }} className="text-base text-muted">
                Drag the slider and watch the zones. Each one hides a different result.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
            {unlocked ? <Check className="size-4 text-success" strokeWidth={2.5} /> : <Sparkles className="size-4 text-primary" strokeWidth={2} />}
            Found {found.size} of {outcomes.length} outcomes
          </p>
          {!showCodify && (
            <Button
              size="compact"
              variant={unlocked ? "primary" : "secondary"}
              className={unlocked ? undefined : "!shadow-none"}
              disabled={!unlocked}
              onClick={() => setShowCodify(true)}
            >
              {unlocked ? "What does this show? →" : `Find ${needed - found.size} more to continue`}
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showCodify && (
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
              <Button onClick={onContinue} className="self-start">
                Start the lesson →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
