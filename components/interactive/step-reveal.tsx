"use client";

import { useState } from "react";
import { RichText } from "@/components/rich-text";
import type { StepRevealData } from "./types";

export function StepReveal({ data }: { data: StepRevealData }) {
  const [revealed, setRevealed] = useState(0);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
        {data.title}
      </h3>

      <div className="flex flex-col gap-3">
        {data.steps.map((step, i) => {
          const isVisible = i < revealed;
          const isCurrent = i === revealed - 1;

          return (
            <div
              key={i}
              className={`overflow-hidden rounded-xl border transition-all duration-300 ${
                isVisible
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-background opacity-50"
              }`}
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 ${
                  isCurrent ? "font-semibold" : ""
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isVisible
                      ? "bg-primary text-white"
                      : "bg-border text-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step.label}</span>
              </div>

              {isVisible && (
                <div className="border-t border-primary/20 px-4 py-3">
                  <p className="text-sm text-foreground">
                    <RichText text={step.content} />
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {revealed < data.steps.length ? (
        <button
          type="button"
          onClick={() => setRevealed((r) => r + 1)}
          className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {revealed === 0 ? "Show step 1" : `Show step ${revealed + 1}`} →
        </button>
      ) : (
        <p className="text-sm font-medium text-success">
          ✓ All steps revealed
        </p>
      )}
    </div>
  );
}
