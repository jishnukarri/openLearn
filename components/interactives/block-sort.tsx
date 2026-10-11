"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import type { InteractiveBlockSort } from "@/lib/ai/lessons";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { shortTakeaway } from "@/lib/text-sanitize";

type Phase = "arrange" | "feedback" | "codify";

export function BlockSort({ interactive, onContinue }: { interactive: InteractiveBlockSort; onContinue: () => void }) {
  const blocks = interactive.blocks ?? [];
  const correctOrder = interactive.correctOrder ?? [];
  const [phase, setPhase] = useState<Phase>("arrange");
  const [placed, setPlaced] = useState<number[]>([]); // indices into blocks[]
  const [correct, setCorrect] = useState(false);

  const remaining = blocks
    .map((_, i) => i)
    .filter((i) => !placed.includes(i));

  function placeBlock(idx: number) {
    setPlaced((p) => [...p, idx]);
  }

  function removeBlock(position: number) {
    setPlaced((p) => p.filter((_, i) => i !== position));
  }

  function checkAnswer() {
    const isCorrect =
      placed.length === correctOrder.length &&
      placed.every((v, i) => v === correctOrder[i]);
    setCorrect(isCorrect);
    setPhase("feedback");
  }

  function reset() {
    setPlaced([]);
    setPhase("arrange");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          <RichText text={interactive.prompt} />
        </p>
      </div>

      {/* Answer area */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your answer</p>
        <div className="flex min-h-[52px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-border bg-surface p-3">
          {placed.length === 0 && (
            <p className="self-center text-xs text-muted">Tap blocks below to place them here</p>
          )}
          {placed.map((blockIdx, pos) => (
            <button
              key={`${blockIdx}-${pos}`}
              type="button"
              onClick={() => phase === "arrange" && removeBlock(pos)}
              disabled={phase !== "arrange"}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                phase === "feedback"
                  ? correct
                    ? "border-success/40 bg-success/15 text-success"
                    : pos < correctOrder.length && correctOrder[pos] === blockIdx
                      ? "border-success/40 bg-success/15 text-success"
                      : "border-error/40 bg-error/15 text-error"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {blocks[blockIdx]}
            </button>
          ))}
        </div>
      </div>

      {/* Block pool */}
      {phase === "arrange" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Available blocks</p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => placeBlock(idx)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5"
              >
                {blocks[idx]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {phase === "arrange" && placed.length === correctOrder.length && (
        <div className="flex gap-3">
          <Button onClick={checkAnswer} className="flex-1 justify-center">Check answer</Button>
          <button type="button" onClick={reset} className="text-xs text-muted hover:text-foreground">Reset</button>
        </div>
      )}

      {/* Feedback */}
      {phase === "feedback" && (
        <div className={`animate-fade-slide-up rounded-xl border p-4 ${correct ? "border-success/30 bg-success/8" : "border-error/30 bg-error/8"}`}>
          <p className={`flex items-center gap-1.5 font-semibold text-sm mb-1 ${correct ? "text-success" : "text-error"}`}>
            {correct ? (
              <>
                <PartyPopper className="size-4" strokeWidth={2} />
                Correct!
              </>
            ) : (
              "Not quite"
            )}
          </p>
          {!correct && (
            <div className="flex flex-col gap-1 mb-3">
              <p className="text-xs text-muted">Correct order:</p>
              <div className="flex flex-wrap gap-2">
                {correctOrder.map((idx, i) => (
                  <span key={i} className="rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
                    {blocks[idx]}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setPhase("codify")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Why is this the right order? →
          </button>
        </div>
      )}

      {phase === "codify" && (
        <div className="animate-fade-slide-up flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">The rule</p>
          <p className="text-sm text-foreground"><RichText text={shortTakeaway(interactive.codify)} /></p>
          <Button onClick={onContinue} className="self-start">Start the lesson →</Button>
        </div>
      )}
    </div>
  );
}
