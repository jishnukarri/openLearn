"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { getHintAction } from "@/app/actions/practice";
import { EASE_OUT } from "@/components/motion";

const DEFAULT_MAX = 3;

// Hint state for one question. Hints are fetched one level at a time; the
// number shown is posted with the answer so the server can re-derive them.
// For numeric/maths questions pass `scaffold`: the hint button then opens the
// graded steps instead of text hints.
export function useHints(questionId: string, opts?: { scaffold?: boolean; onScaffold?: () => void }) {
  const [hints, setHints] = useState<string[]>([]);
  const [maxLevel, setMaxLevel] = useState(DEFAULT_MAX);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const scaffold = !!opts?.scaffold;
  const onScaffold = opts?.onScaffold;

  const next = useCallback(async () => {
    if (scaffold) {
      onScaffold?.();
      return;
    }
    if (loading || hints.length >= maxLevel || unavailable) return;
    setLoading(true);
    setError(null);
    try {
      const level = Math.min(3, hints.length + 1) as 1 | 2 | 3;
      const res = await getHintAction({ questionId, level });
      if ("unavailable" in res) setUnavailable(true);
      else {
        setHints((h) => [...h, res.hint]);
        setMaxLevel(res.maxLevel);
      }
    } catch {
      setError("Couldn't load a hint. Try again.");
    } finally {
      setLoading(false);
    }
  }, [questionId, hints.length, loading, maxLevel, unavailable, scaffold, onScaffold]);

  return { hints, next, loading, error, unavailable, scaffold, maxLevel, exhausted: hints.length >= maxLevel };
}

export type HintState = ReturnType<typeof useHints>;

export function HintButton({ state, disabled }: { state: HintState; disabled?: boolean }) {
  const { hints, next, loading, exhausted, unavailable, scaffold } = state;
  const label = loading
    ? "Finding a hint…"
    : scaffold
      ? "Let's break it down"
      : unavailable
        ? "No hint available"
        : exhausted
          ? "No more hints"
          : hints.length === 0
            ? "Give me a hint"
            : "Another hint";
  return (
    <button
      type="button"
      onClick={next}
      disabled={disabled || loading || (!scaffold && (exhausted || unavailable))}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
    >
      <Lightbulb className="size-4 text-highlight" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}

export function HintPanel({ state }: { state: HintState }) {
  const { hints, error, exhausted, unavailable, maxLevel } = state;
  return (
    <MotionConfig reducedMotion="user">
      <div aria-live="polite" className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {hints.map((hint, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="rounded-xl bg-highlight/5 px-4 py-2"
            >
              <p className="font-[family-name:var(--font-mono)] text-sm text-highlight">
                Hint {i + 1} of {maxLevel}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{hint}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {unavailable && <p className="text-sm text-muted">No hint available for this question.</p>}
        {exhausted && <p className="text-sm text-muted">No more hints. Have a go in your own words.</p>}
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </MotionConfig>
  );
}
