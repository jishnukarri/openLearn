"use client";

import { useState } from "react";
import type { InteractiveSliderSim } from "@/lib/ai/lessons";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { collapseRepeatedChars } from "@/lib/text-sanitize";

function pct(value: number, min: number, max: number) {
  return ((value - min) / (max - min)) * 100;
}

function findOutcome(sliders: InteractiveSliderSim["sliders"], values: number[], outcomes: InteractiveSliderSim["outcomes"]) {
  if (!sliders.length || !outcomes.length) return null;
  const p = pct(values[0], sliders[0].min, sliders[0].max);
  return outcomes.find((o) => p >= o.minThreshold && p <= o.maxThreshold) ?? outcomes[outcomes.length - 1];
}

export function SliderSim({ interactive, onContinue }: { interactive: InteractiveSliderSim; onContinue: () => void }) {
  const sliders = interactive.sliders ?? [];
  const outcomes = interactive.outcomes ?? [];
  const [values, setValues] = useState(() => sliders.map((s) => s.default));
  const [interacted, setInteracted] = useState(false);
  const [showCodify, setShowCodify] = useState(false);

  const outcome = findOutcome(sliders, values, outcomes);

  function handleSlider(i: number, v: number) {
    const next = [...values];
    next[i] = v;
    setValues(next);
    setInteracted(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          {collapseRepeatedChars(interactive.title)}
        </h3>
        <p className="text-sm text-muted">{interactive.description}</p>
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        {sliders.map((slider, i) => (
          <div key={slider.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">{slider.label}</label>
              <span className="font-[family-name:var(--font-mono)] text-sm text-primary">
                {values[i]} {slider.unit}
              </span>
            </div>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={values[i]}
              onChange={(e) => handleSlider(i, Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="flex justify-between text-3xs text-muted">
              <span>{slider.min} {slider.unit}</span>
              <span>{slider.max} {slider.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Outcome display */}
      {interacted && outcome && (
        <div className="animate-fade-slide-up flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/8 p-4">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary w-fit">
            {outcome.label}
          </span>
          <p className="text-sm text-foreground">
            <RichText text={outcome.description} />
          </p>
        </div>
      )}

      {!interacted && sliders.length > 0 && (
        <p className="text-center text-xs text-muted">Move the slider to see what happens →</p>
      )}

      {sliders.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-sm text-muted">This interactive didn&apos;t generate properly.</p>
          <Button onClick={onContinue} variant="secondary" size="compact">
            Skip to lesson →
          </Button>
        </div>
      )}

      {/* Codify */}
      {showCodify ? (
        <div className="animate-fade-slide-up flex flex-col gap-3 rounded-xl border border-success/30 bg-success/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-success">What this means</p>
          <p className="text-sm text-foreground"><RichText text={interactive.codify} /></p>
          <Button onClick={onContinue} className="self-start">
            Start the lesson →
          </Button>
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
