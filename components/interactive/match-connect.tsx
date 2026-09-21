"use client";

import { useState } from "react";
import type { MatchConnectData } from "./types";

export function MatchConnect({ data }: { data: MatchConnectData }) {
  const [selected, setSelected] = useState<{ side: "left" | "right"; idx: number } | null>(null);
  const [connections, setConnections] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  const connectedLeft = new Set(Object.keys(connections).map(Number));
  const connectedRight = new Set(Object.values(connections));
  const allConnected = connectedLeft.size === data.pairs.length;

  const correctRight = data.pairs.map((_, i) => i);

  function handleLeft(idx: number) {
    if (checked) return;
    if (selected?.side === "right") {
      // Connect left to already-selected right
      const rightIdx = selected.idx;
      const next = { ...connections };
      // Remove any existing connection to this right slot
      for (const k in next) {
        if (next[k] === rightIdx) delete next[k];
      }
      // Remove existing connection from this left slot
      delete next[idx];
      next[idx] = rightIdx;
      setConnections(next);
      setSelected(null);
    } else {
      setSelected(selected?.idx === idx && selected.side === "left" ? null : { side: "left", idx });
    }
  }

  function handleRight(idx: number) {
    if (checked) return;
    if (selected?.side === "left") {
      const leftIdx = selected.idx;
      const next = { ...connections };
      for (const k in next) {
        if (next[k] === idx) delete next[k];
      }
      next[leftIdx] = idx;
      setConnections(next);
      setSelected(null);
    } else {
      setSelected(selected?.idx === idx && selected.side === "right" ? null : { side: "right", idx });
    }
  }

  function reset() {
    setConnections({});
    setSelected(null);
    setChecked(false);
  }

  const isCorrect =
    allConnected &&
    data.pairs.every((_, leftIdx) => connections[leftIdx] === correctRight[leftIdx]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm font-medium text-muted">{data.instruction}</p>
      <p className="text-xs text-muted">
        Tap a left item then a right item to connect them.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          {data.pairs.map((pair, i) => {
            const isConnected = connectedLeft.has(i);
            const matchedRight = isConnected ? connections[i] : null;
            const correct = checked && matchedRight === correctRight[i];
            const wrong = checked && matchedRight !== correctRight[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleLeft(i)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-all ${
                  selected?.side === "left" && selected.idx === i
                    ? "border-primary bg-primary/10"
                    : correct
                    ? "border-success/40 bg-success/10"
                    : wrong
                    ? "border-error/40 bg-error/10"
                    : isConnected
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background hover:border-primary/50"
                } text-foreground`}
              >
                {pair.left}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2">
          {data.pairs.map((pair, i) => {
            const isConnected = connectedRight.has(i);
            const correct = checked && Object.entries(connections).some(
              ([l, r]) => Number(r) === i && Number(l) === i
            );
            const wrong = checked && isConnected && !correct;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleRight(i)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-all ${
                  selected?.side === "right" && selected.idx === i
                    ? "border-primary bg-primary/10"
                    : correct
                    ? "border-success/40 bg-success/10"
                    : wrong
                    ? "border-error/40 bg-error/10"
                    : isConnected
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background hover:border-primary/50"
                } text-foreground`}
              >
                {pair.right}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        {allConnected && !checked && (
          <button
            type="button"
            onClick={() => setChecked(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Check connections
          </button>
        )}
        {checked && !isCorrect && (
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:border-primary/50"
          >
            Try again
          </button>
        )}
        {checked && isCorrect && (
          <p className="text-sm font-medium text-success">✓ All matched correctly!</p>
        )}
      </div>
    </div>
  );
}
