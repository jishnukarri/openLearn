"use client";

import { ArrowLeft, BookMarked, HelpCircle, X } from "lucide-react";
import { stepLabel, type StageName } from "./lesson-plan";

// Persistent header: where am I, what stage is this, how do I go back, and
// where do I get help. Everything sits in the same place on every step.
export function LessonHeader({
  title,
  index,
  total,
  stage,
  canGoBack,
  helpOpen,
  recapOpen,
  recapCount,
  onBack,
  onQuit,
  onToggleHelp,
  onToggleRecap,
}: {
  title: string;
  index: number;
  total: number;
  stage: StageName;
  canGoBack: boolean;
  helpOpen: boolean;
  recapOpen: boolean;
  recapCount: number;
  onBack: () => void;
  onQuit: () => void;
  onToggleHelp: () => void;
  onToggleRecap: () => void;
}) {
  const pill =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none";
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-3 pb-3 pt-2 backdrop-blur-sm sm:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Quit lesson"
          onClick={onQuit}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-error hover:text-error-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
        <p className="min-w-0 flex-1 truncate font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
          {title}
        </p>
        <button
          type="button"
          onClick={onToggleRecap}
          aria-expanded={recapOpen}
          disabled={recapCount === 0}
          title={recapCount === 0 ? "Nothing to recap yet" : undefined}
          className={`${pill} ${recapOpen ? "border-primary bg-primary/10 text-primary-ink" : "border-border text-muted hover:border-primary hover:text-foreground"} disabled:pointer-events-none disabled:opacity-40`}
        >
          <BookMarked className="size-4" strokeWidth={2} />
          <span className="hidden sm:inline">Recap so far</span>
          <span className="sm:hidden">Recap</span>
        </button>
        <button
          type="button"
          onClick={onToggleHelp}
          aria-expanded={helpOpen}
          className={`${pill} ${helpOpen ? "border-primary bg-primary text-white" : "border-primary/40 text-primary-ink hover:bg-primary/10"}`}
        >
          <HelpCircle className="size-4" strokeWidth={2} />
          Stuck? Help
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          aria-keyshortcuts="ArrowLeft"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" strokeWidth={2} /> Back
        </button>
        <p className="text-sm text-foreground">
          <span className="font-semibold">{stepLabel(index, total)}</span>
          <span className="text-muted"> · {stage}</span>
        </p>
      </div>

      <div
        className="mt-1 flex gap-1"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
              i < index ? "bg-primary" : i === index ? "bg-primary/50" : "bg-surface"
            }`}
          />
        ))}
      </div>
    </header>
  );
}
