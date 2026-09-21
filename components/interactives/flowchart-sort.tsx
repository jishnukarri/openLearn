"use client";

import { useState } from "react";
import type { InteractiveFlowchart } from "@/lib/ai/lessons";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";

type Phase = "arrange" | "feedback" | "codify";

export function FlowchartSort({ interactive, onContinue }: { interactive: InteractiveFlowchart; onContinue: () => void }) {
  const steps = interactive.steps ?? [];
  const correctOrder = interactive.correctOrder ?? steps.map((_, i) => i);
  // Start with steps in original (scrambled) order
  const [order, setOrder] = useState<number[]>(() => steps.map((_, i) => i));
  const [phase, setPhase] = useState<Phase>("arrange");
  const [correct, setCorrect] = useState(false);
  const [selected, setSelected] = useState<number | null>(null); // index in order[] that is "picked up"

  function tap(positionInOrder: number) {
    if (selected === null) {
      setSelected(positionInOrder);
    } else {
      // Swap selected with tapped position
      const next = [...order];
      [next[selected], next[positionInOrder]] = [next[positionInOrder], next[selected]];
      setOrder(next);
      setSelected(null);
    }
  }

  function checkAnswer() {
    const isCorrect = order.every((stepIdx, pos) => stepIdx === correctOrder[pos]);
    setCorrect(isCorrect);
    setPhase("feedback");
  }

  function reset() {
    setOrder(steps.map((_, i) => i));
    setPhase("arrange");
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          <RichText text={interactive.prompt} />
        </p>
        {phase === "arrange" && (
          <p className="text-xs text-muted">Tap a step to select it, then tap another to swap them.</p>
        )}
      </div>

      {/* Step cards */}
      <div className="flex flex-col gap-2">
        {order.map((stepIdx, pos) => {
          const step = steps[stepIdx];
          const isSelected = selected === pos;

          let statusClass = "";
          if (phase === "feedback") {
            statusClass =
              correctOrder[pos] === stepIdx
                ? "border-success/40 bg-success/8"
                : "border-error/40 bg-error/8";
          } else if (isSelected) {
            statusClass = "border-primary bg-primary/10 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]";
          } else {
            statusClass = "border-border bg-surface hover:border-primary/50 hover:bg-primary/5";
          }

          return (
            <button
              key={pos}
              type="button"
              onClick={() => phase === "arrange" && tap(pos)}
              disabled={phase !== "arrange"}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${statusClass}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                phase === "feedback"
                  ? correctOrder[pos] === stepIdx
                    ? "bg-success text-white"
                    : "bg-error text-white"
                  : isSelected
                    ? "bg-primary text-white"
                    : "border border-border text-muted"
              }`}>
                {pos + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <p className="text-xs text-muted mt-0.5">{step.description}</p>
              </div>
              {phase === "arrange" && !isSelected && (
                <span className="shrink-0 text-muted text-xs self-center">⇅</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Check button */}
      {phase === "arrange" && (
        <div className="flex gap-3">
          <Button onClick={checkAnswer} className="flex-1 justify-center">Check my order</Button>
          <button type="button" onClick={reset} className="text-xs text-muted hover:text-foreground">Reset</button>
        </div>
      )}

      {/* Feedback */}
      {phase === "feedback" && (
        <div className={`animate-fade-slide-up rounded-xl border p-4 ${correct ? "border-success/30 bg-success/8" : "border-error/30 bg-error/8"}`}>
          <p className={`font-semibold text-sm mb-2 ${correct ? "text-success" : "text-error"}`}>
            {correct ? "Perfect order! 🎉" : "Not quite right"}
          </p>
          {!correct && (
            <div className="mb-3">
              <p className="text-xs text-muted mb-2">Correct sequence:</p>
              <ol className="flex flex-col gap-1">
                {correctOrder.map((stepIdx, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-3xs font-bold text-success">
                      {i + 1}
                    </span>
                    {steps[stepIdx].label}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <button
            type="button"
            onClick={() => setPhase("codify")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Explain the process →
          </button>
        </div>
      )}

      {phase === "codify" && (
        <div className="animate-fade-slide-up flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">How it works</p>
          <p className="text-sm text-foreground"><RichText text={interactive.codify} /></p>
          <Button onClick={onContinue} className="self-start">Start the lesson →</Button>
        </div>
      )}
    </div>
  );
}
