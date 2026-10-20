"use client";

import type { ReactNode } from "react";

type State = "default" | "selected" | "correct" | "incorrect";

// Every visual effect here is a plain CSS class toggle, no react-spring,
// no inline `style` writes. react-spring's animated.* writes to the DOM
// outside React's render cycle, and any transform mutation near a touch
// event (even a "no-op" one re-applying the same value) can make iOS/mobile
// Safari silently drop the pending tap. Plain class-driven CSS transitions
// don't have that failure mode.
const BUTTON_STYLE: Record<State, string> = {
  default:
    "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
  selected: "border-primary bg-primary/10 text-foreground",
  correct: "border-success bg-success/10 text-foreground scale-[1.01]",
  incorrect: "border-error bg-error/10 text-foreground animate-shake-x",
};

const LABEL_STYLE: Record<State, string> = {
  default: "border-border text-muted bg-background",
  selected: "border-primary text-primary bg-primary/15",
  correct: "border-success text-success bg-success/20",
  incorrect: "border-error text-error bg-error/20",
};

export function OptionButton({
  children,
  state = "default",
  disabled,
  onClick,
  label,
}: {
  children: ReactNode;
  state?: State;
  disabled?: boolean;
  onClick?: (el: HTMLButtonElement) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => onClick?.(e.currentTarget)}
      className={`flex min-h-11 touch-manipulation items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 ${BUTTON_STYLE[state]}`}
    >
      {label && (
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-2xs font-bold transition-colors ${LABEL_STYLE[state]}`}
        >
          {label}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </button>
  );
}
