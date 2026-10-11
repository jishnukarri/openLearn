"use client";

import { useState, useRef } from "react";
import type { InteractiveCategorize } from "@/lib/ai/lessons";
import { RichText } from "@/components/rich-text";

export function Categorize({
  interactive,
  onContinue,
}: {
  interactive: InteractiveCategorize;
  onContinue: () => void;
}) {
  const categories = interactive.categories ?? [];
  const items = interactive.items ?? [];
  const codify = interactive.codify ?? "";
  const prompt = interactive.prompt ?? "";

  // Normalize to 0-indexed in case AI generates 1-indexed values
  const rawMapping = interactive.correctMapping ?? [];
  const minIdx = rawMapping.length > 0 ? Math.min(...rawMapping) : 0;
  const correctMapping = minIdx > 0 ? rawMapping.map((v) => v - minIdx) : rawMapping;

  // null = in pool, number = placed in that category index
  const [placements, setPlacements] = useState<(number | null)[]>(
    () => items.map(() => null)
  );
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const allPlaced = placements.every((p) => p !== null);

  // ── Drag ──────────────────────────────────────────────────────────────────

  function onDragStart(itemIdx: number) {
    dragItem.current = itemIdx;
  }

  function onDropInCategory(catIdx: number) {
    const idx = dragItem.current;
    if (idx === null || checked) return;
    setPlacements((prev) => { const n = [...prev]; n[idx] = catIdx; return n; });
    dragItem.current = null;
    setSelected(null);
  }

  function onDropInPool() {
    const idx = dragItem.current;
    if (idx === null || checked) return;
    setPlacements((prev) => { const n = [...prev]; n[idx] = null; return n; });
    dragItem.current = null;
    setSelected(null);
  }

  function prevent(e: React.DragEvent) { e.preventDefault(); }

  // ── Tap ───────────────────────────────────────────────────────────────────

  function tapItem(itemIdx: number) {
    if (checked) return;
    setSelected(selected === itemIdx ? null : itemIdx);
  }

  function tapCategory(catIdx: number) {
    if (checked || selected === null) return;
    setPlacements((prev) => { const n = [...prev]; n[selected] = catIdx; return n; });
    setSelected(null);
  }

  function returnToPool(itemIdx: number) {
    if (checked) return;
    setPlacements((prev) => { const n = [...prev]; n[itemIdx] = null; return n; });
    setSelected(null);
  }

  // ── Results ───────────────────────────────────────────────────────────────

  const correctCount = placements.filter(
    (p, i) => p !== null && p === (correctMapping[i] ?? -1)
  ).length;
  const allCorrect = checked && correctCount === items.length;

  // ── Item card, plain function, not a component, to avoid remounting ──────

  function itemCard(itemIdx: number, inColumn: boolean) {
    const item = items[itemIdx];
    const isSelected = selected === itemIdx && !checked;
    const isCorrect = checked && placements[itemIdx] === (correctMapping[itemIdx] ?? -1);
    const isWrong = checked && inColumn && !isCorrect;

    return (
      <button
        type="button"
        key={itemIdx}
        draggable={!checked}
        disabled={checked}
        aria-pressed={!inColumn ? isSelected : undefined}
        onDragStart={() => onDragStart(itemIdx)}
        onClick={(e) => {
          e.stopPropagation();
          if (inColumn) returnToPool(itemIdx);
          else tapItem(itemIdx);
        }}
        className={[
          "select-none text-left text-sm px-3 py-2 rounded-md border transition-all",
          checked
            ? isCorrect
              ? "bg-success/10 border-success/40 text-success cursor-default"
              : isWrong
              ? "bg-error/10 border-error/40 text-error cursor-default"
              : "bg-surface border-border cursor-default"
            : isSelected
            ? "border-primary bg-primary/10 font-medium shadow-sm cursor-grab"
            : "bg-surface border-border hover:border-primary hover:shadow-sm cursor-grab active:cursor-grabbing",
        ].join(" ")}
      >
        {isWrong && (
          <span className="mb-0.5 block text-sm opacity-80">
            → {categories[correctMapping[itemIdx] ?? 0]?.label}
          </span>
        )}
        <RichText text={item} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {prompt && (
        <p className="text-sm font-medium text-foreground">
          <RichText text={prompt} />
        </p>
      )}

      <p className="text-sm text-muted">
        Drag cards into the correct column, or tap a card then tap a column.
      </p>

      {/* Category columns */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.max(categories.length, 1)}, 1fr)` }}
      >
        {categories.map((cat, catIdx) => {
          const placed = items.map((_, i) => i).filter((i) => placements[i] === catIdx);
          return (
            <div key={catIdx} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => tapCategory(catIdx)}
                onDragOver={!checked ? prevent : undefined}
                onDrop={!checked ? () => onDropInCategory(catIdx) : undefined}
                className={[
                  "flex min-h-[3.25rem] items-center justify-center text-sm font-semibold px-3 py-2 rounded-lg border-2 transition-all",
                  selected !== null && !checked
                    ? "border-primary bg-primary/10 cursor-pointer"
                    : "border-border bg-surface cursor-default",
                ].join(" ")}
              >
                {cat.label}
              </button>

              <div
                onClick={() => tapCategory(catIdx)}
                onDragOver={!checked ? prevent : undefined}
                onDrop={!checked ? () => onDropInCategory(catIdx) : undefined}
                className={[
                  "min-h-[72px] flex flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
                  selected !== null && !checked
                    ? "cursor-pointer border-primary/60 bg-primary/5"
                    : "border-border",
                ].join(" ")}
              >
                {placed.map((i) => itemCard(i, true))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pool */}
      <div
        onDragOver={!checked ? prevent : undefined}
        onDrop={!checked ? onDropInPool : undefined}
        className="flex flex-wrap gap-2 min-h-[40px] rounded-lg p-1"
      >
        {items.map((_, i) => placements[i] === null ? itemCard(i, false) : null)}
      </div>

      {/* Codify */}
      {checked && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className={[
            "font-semibold mb-1",
            allCorrect ? "text-success" : "text-foreground",
          ].join(" ")}>
            {allCorrect ? "Perfect!" : `${correctCount} / ${items.length} correct`}
          </p>
          <p className="text-sm text-foreground">
            <RichText text={codify} />
          </p>
        </div>
      )}

      <div className="flex gap-3">
        {!checked ? (
          <button
            type="button"
            onClick={() => setChecked(true)}
            disabled={!allPlaced}
            className="flex-1 py-3 rounded-xl font-semibold bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
          >
            Check
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 py-3 rounded-xl font-semibold bg-primary text-primary-foreground"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
