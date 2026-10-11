"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { InteractiveBranching } from "@/lib/ai/lessons";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { shortTakeaway } from "@/lib/text-sanitize";

type Phase = "choose" | "consequence" | "codify";

export function BranchingDilemma({ interactive, onContinue }: { interactive: InteractiveBranching; onContinue: () => void }) {
  const choices = interactive.choices ?? [];
  const [phase, setPhase] = useState<Phase>("choose");
  const [chosen, setChosen] = useState<string | null>(null);

  const choice = choices.find((c) => c.id === chosen);

  function pick(id: string) {
    setChosen(id);
    setPhase("consequence");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-highlight/30 bg-highlight/8 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-highlight mb-2">Your decision</p>
        <p className="text-sm font-medium text-foreground leading-relaxed">
          <RichText text={interactive.scenario} />
        </p>
      </div>

      {phase === "choose" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted text-center">What would you do?</p>
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-all hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold text-muted">
                {c.id.toUpperCase()}
              </span>
              <p className="text-sm font-medium text-foreground">{c.label}</p>
            </button>
          ))}
        </div>
      )}

      {phase === "consequence" && choice && (
        <div className="animate-fade-slide-up flex flex-col gap-4">
          <div className={`rounded-xl border p-5 ${choice.isOptimal ? "border-success/30 bg-success/8" : "border-error/30 bg-error/8"}`}>
            <div className="flex items-center gap-2 mb-3">
              {choice.isOptimal ? (
                <Check className="size-4 text-success" strokeWidth={2.5} />
              ) : (
                <X className="size-4 text-error" strokeWidth={2.5} />
              )}
              <p className={`text-xs font-semibold uppercase tracking-wide ${choice.isOptimal ? "text-success" : "text-error"}`}>
                {choice.isOptimal ? "That worked out" : "That caused problems"}
              </p>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{choice.label}</p>
            <p className="text-sm text-foreground leading-relaxed">
              <RichText text={choice.consequence} />
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPhase("codify")}
            className="self-center text-sm font-medium text-primary hover:underline"
          >
            Now explain why →
          </button>
        </div>
      )}

      {phase === "codify" && (
        <div className="animate-fade-slide-up flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">The history</p>
          <p className="text-sm text-foreground leading-relaxed">
            <RichText text={shortTakeaway(interactive.codify)} />
          </p>
          <Button onClick={onContinue} className="self-start mt-2">
            Start the lesson →
          </Button>
        </div>
      )}
    </div>
  );
}
