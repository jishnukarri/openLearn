"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { getQuestionHintAction } from "@/app/actions/practice";
import { EASE_OUT } from "@/components/motion";

const TOTAL = 3;

// Hint state for one question. Hints are fetched one level at a time; the
// number shown is posted with the answer so the server can re-derive them.
export function useHints(questionId: string) {
  const [hints, setHints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = useCallback(async () => {
    if (loading || hints.length >= TOTAL) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getQuestionHintAction(questionId, hints.length + 1);
      if ("hint" in res) setHints((h) => [...h, res.hint]);
      else setError(res.message);
    } catch {
      setError("Couldn't load a hint. Try again.");
    } finally {
      setLoading(false);
    }
  }, [questionId, hints.length, loading]);

  return { hints, next, loading, error, exhausted: hints.length >= TOTAL };
}

export type HintState = ReturnType<typeof useHints>;

export function HintButton({ state, disabled }: { state: HintState; disabled?: boolean }) {
  const { hints, next, loading, exhausted } = state;
  return (
    <button
      type="button"
      onClick={next}
      disabled={disabled || loading || exhausted}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
    >
      <Lightbulb className="size-4 text-highlight" strokeWidth={2} aria-hidden />
      {loading ? "Finding a hint…" : exhausted ? "No more hints" : hints.length === 0 ? "Give me a hint" : "Another hint"}
    </button>
  );
}

export function HintPanel({ state }: { state: HintState }) {
  const { hints, error, exhausted } = state;
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
              className="border-l-2 border-highlight bg-highlight/5 py-2 pl-4 pr-3"
            >
              <p className="font-[family-name:var(--font-mono)] text-sm text-highlight">
                Hint {i + 1} of {TOTAL}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{hint}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {exhausted && <p className="text-sm text-muted">No more hints. Have a go in your own words.</p>}
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </MotionConfig>
  );
}
