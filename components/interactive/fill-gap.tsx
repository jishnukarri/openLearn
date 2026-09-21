"use client";

import { useState } from "react";
import type { FillGapData } from "./types";

export function FillGap({ data }: { data: FillGapData }) {
  const [inputs, setInputs] = useState<string[]>(data.answers.map(() => ""));
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const correct = data.answers.map(
    (ans, i) => inputs[i].trim().toLowerCase() === ans.toLowerCase()
  );
  const allCorrect = correct.every(Boolean);

  // Split template on ___ to interleave inputs
  const parts = data.template.split("___");

  function check() {
    setChecked(true);
  }

  function reset() {
    setInputs(data.answers.map(() => ""));
    setChecked(false);
    setShowHint(false);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm font-medium text-muted">{data.instruction}</p>

      <div className="flex flex-wrap items-baseline gap-1 text-base text-foreground leading-relaxed">
        {parts.map((part, i) => (
          <span key={i} className="inline-flex flex-wrap items-baseline gap-1">
            <span>{part}</span>
            {i < data.answers.length && (
              <input
                value={inputs[i]}
                onChange={(e) => {
                  const next = [...inputs];
                  next[i] = e.target.value;
                  setInputs(next);
                  setChecked(false);
                }}
                placeholder="..."
                disabled={checked && correct[i]}
                className={`inline-block w-24 rounded-lg border px-2 py-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  !checked
                    ? "border-border bg-background text-foreground"
                    : correct[i]
                    ? "border-success/50 bg-success/10 text-success"
                    : "border-error/50 bg-error/10 text-error"
                }`}
              />
            )}
          </span>
        ))}
      </div>

      {checked && (
        <div className="flex flex-col gap-1">
          {correct.map((c, i) =>
            !c ? (
              <p key={i} className="text-xs text-muted">
                Gap {i + 1}: correct answer is{" "}
                <strong className="text-foreground">{data.answers[i]}</strong>
              </p>
            ) : null
          )}
        </div>
      )}

      {data.hint && (
        <div>
          {!showHint ? (
            <button
              type="button"
              onClick={() => setShowHint(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Show hint
            </button>
          ) : (
            <p className="rounded-lg bg-highlight/10 px-3 py-1.5 text-xs text-highlight">
              💡 {data.hint}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {!allCorrect && (
          <button
            type="button"
            onClick={check}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Check
          </button>
        )}
        {checked && !allCorrect && (
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:border-primary/50"
          >
            Try again
          </button>
        )}
        {allCorrect && (
          <p className="text-sm font-medium text-success">✓ Correct!</p>
        )}
      </div>
    </div>
  );
}
