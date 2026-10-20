"use client";

import { useId, useRef } from "react";
import { Calculator } from "@/components/calculator";

// Answer box for single-number questions: big decimal input labelled with
// the expected unit, plus the built-in calculator (numeric questions only).
export function NumericAnswer({
  value,
  onChange,
  unit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        Your answer{unit ? ` (in ${unit})` : ""}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
          placeholder="0"
          className="min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 py-3 font-mono text-2xl text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        />
        {unit && (
          <span
            aria-hidden
            className="flex items-center rounded-2xl border border-border bg-background px-4 text-base font-medium text-muted"
          >
            {unit}
          </span>
        )}
      </div>
      <p id={hintId} className="text-sm text-muted">
        {unit
          ? `Give a number and include the unit (${unit}). Decimals, fractions and 3.2e3 all work.`
          : "Give a number. Decimals, fractions and 3.2e3 all work."}
      </p>
      {!disabled && <Calculator onUse={onChange} returnFocusTo={inputRef} />}
    </div>
  );
}
