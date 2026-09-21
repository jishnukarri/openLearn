"use client";

import { useState } from "react";
import type { SortOrderData } from "./types";

export function SortOrder({ data }: { data: SortOrderData }) {
  const [order, setOrder] = useState<string[]>(() => [...data.items]);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const isCorrect = order.every((item, i) => item === data.correct[i]);

  function handleClick(idx: number) {
    if (checked && isCorrect) return;
    setChecked(false);
    if (selected === null) {
      setSelected(idx);
    } else if (selected === idx) {
      setSelected(null);
    } else {
      // Swap
      const next = [...order];
      [next[selected], next[idx]] = [next[idx], next[selected]];
      setOrder(next);
      setSelected(null);
    }
  }

  function reset() {
    setOrder([...data.items]);
    setSelected(null);
    setChecked(false);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm font-medium text-muted">{data.instruction}</p>
      <p className="text-xs text-muted">Tap an item to select it, then tap another to swap.</p>

      <div className="flex flex-col gap-2">
        {order.map((item, i) => {
          const itemCorrect = checked && item === data.correct[i];
          const itemWrong = checked && item !== data.correct[i];
          return (
            <button
              key={item}
              type="button"
              onClick={() => handleClick(i)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                selected === i
                  ? "border-primary bg-primary/10 text-foreground"
                  : itemCorrect
                  ? "border-success/40 bg-success/10 text-foreground"
                  : itemWrong
                  ? "border-error/40 bg-error/10 text-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  selected === i
                    ? "bg-primary text-white"
                    : itemCorrect
                    ? "bg-success text-white"
                    : "bg-border text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span>{item}</span>
            </button>
          );
        })}
      </div>

      {checked && !isCorrect && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">Correct order:</p>
          {data.correct.map((item, i) => (
            <p key={i} className="text-xs text-foreground">
              {i + 1}. {item}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {!isCorrect && (
          <button
            type="button"
            onClick={() => setChecked(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Check order
          </button>
        )}
        {checked && !isCorrect && (
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:border-primary/50"
          >
            Reset
          </button>
        )}
        {isCorrect && checked && (
          <p className="text-sm font-medium text-success">✓ Correct order!</p>
        )}
      </div>
    </div>
  );
}
