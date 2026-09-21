"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RichText } from "@/components/rich-text";

type Point = { x: number; y: number };

// Draw-a-line matching: drag from a left dot to a right dot to connect
// them, like pairing terms on paper. `rights` is pre-shuffled by the
// caller, `index` on each is its original pair index, so a connection is
// "correct" when leftIndex === rights[pickIndex].index.
export function MatchingBoard({
  lefts,
  rights,
  value,
  onChange,
  revealed,
  correctRightIndex,
}: {
  lefts: string[];
  rights: { label: string; index: number }[];
  // leftIndex -> position in `rights` array (not the original pair index)
  value: Record<number, number>;
  onChange: (next: Record<number, number>) => void;
  revealed: boolean;
  // Only used when revealed, to show right/wrong per connection.
  correctRightIndex?: (leftIndex: number) => number;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rightRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  // Tap-to-connect fallback for touch/accessibility: tap a left dot to
  // "arm" it, then tap a right dot to connect, no drag required.
  const [armedLeft, setArmedLeft] = useState<number | null>(null);
  const [leftPoints, setLeftPoints] = useState<(Point | null)[]>([]);
  const [rightPoints, setRightPoints] = useState<(Point | null)[]>([]);

  function anchorOf(el: HTMLElement | null, board: HTMLElement, side: "left" | "right"): Point | null {
    if (!el) return null;
    const elRect = el.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    return {
      x: (side === "left" ? elRect.right : elRect.left) - boardRect.left,
      y: elRect.top + elRect.height / 2 - boardRect.top,
    };
  }

  // Anchors are measured after paint (not read from refs during render —
  // refs aren't render-safe) whenever layout could have moved them: mount,
  // item count changes, window resize, or a drag/tap changing connections.
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      setLeftPoints(leftRefs.current.map((el) => anchorOf(el, board, "left")));
      setRightPoints(rightRefs.current.map((el) => anchorOf(el, board, "right")));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [lefts.length, rights.length, value, revealed]);

  function pointFromEvent(e: PointerEvent | React.PointerEvent): Point | null {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrag(leftIndex: number, e: React.PointerEvent) {
    if (revealed) return;
    e.preventDefault();
    setArmedLeft(null);
    setDragFrom(leftIndex);
    setDragPoint(pointFromEvent(e));
  }

  function tapRight(rightPos: number) {
    if (revealed || armedLeft === null) return;
    onChange({ ...value, [armedLeft]: rightPos });
    setArmedLeft(null);
  }

  useEffect(() => {
    if (dragFrom === null) return;

    function move(e: PointerEvent) {
      setDragPoint(pointFromEvent(e));
    }

    function up(e: PointerEvent) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const hitIndex = rightRefs.current.findIndex((r) => r && r.contains(target));
      if (hitIndex !== -1 && dragFrom !== null) {
        onChange({ ...value, [dragFrom]: hitIndex });
        setArmedLeft(null);
      } else if (dragFrom !== null) {
        // Released without reaching a right item, treat as a tap: arm this
        // left for tap-to-connect, or disarm it if it was already armed.
        setArmedLeft((current) => (current === dragFrom ? null : dragFrom));
      }
      setDragFrom(null);
      setDragPoint(null);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dragFrom drives this effect's own lifecycle
  }, [dragFrom]);

  const connections = lefts.map((_, leftIndex) => {
    const rightPos = value[leftIndex];
    if (rightPos === undefined) return null;
    const from = leftPoints[leftIndex];
    const to = rightPoints[rightPos];
    if (!from || !to) return null;
    const correct = revealed && correctRightIndex?.(leftIndex) === rightPos;
    const wrong = revealed && correctRightIndex && !correct;
    return { leftIndex, from, to, correct, wrong };
  });

  const liveFrom = dragFrom !== null ? leftPoints[dragFrom] ?? null : null;

  return (
    <div ref={boardRef} className="relative flex touch-none select-none gap-8">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {connections.map(
          (c) =>
            c && (
              <line
                key={c.leftIndex}
                x1={c.from.x}
                y1={c.from.y}
                x2={c.to.x}
                y2={c.to.y}
                stroke={
                  c.correct
                    ? "var(--success)"
                    : c.wrong
                      ? "var(--error)"
                      : "var(--primary)"
                }
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            )
        )}
        {dragFrom !== null && liveFrom && dragPoint && (
          <line
            x1={liveFrom.x}
            y1={liveFrom.y}
            x2={dragPoint.x}
            y2={dragPoint.y}
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="relative z-10 flex flex-1 flex-col gap-3">
        {lefts.map((left, i) => (
          <button
            key={i}
            ref={(el) => {
              leftRefs.current[i] = el;
            }}
            type="button"
            onPointerDown={(e) => startDrag(i, e)}
            style={{ touchAction: "none" }}
            className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm text-foreground transition-colors ${
              armedLeft === i
                ? "border-primary ring-2 ring-primary/40"
                : value[i] !== undefined
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface"
            } ${revealed ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
          >
            <RichText text={left} />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
              aria-hidden
            />
          </button>
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-3">
        {rights.map((right, i) => (
          <button
            key={i}
            ref={(el) => {
              rightRefs.current[i] = el;
            }}
            type="button"
            onClick={() => tapRight(i)}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm text-foreground transition-colors ${
              Object.values(value).includes(i)
                ? "border-primary bg-primary/5"
                : armedLeft !== null
                  ? "border-primary/50 bg-primary/5 animate-pulse"
                  : "border-border bg-surface"
            } ${revealed ? "cursor-default" : "cursor-pointer"}`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
              aria-hidden
            />
            <RichText text={right.label} />
          </button>
        ))}
      </div>
    </div>
  );
}
