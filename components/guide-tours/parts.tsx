"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { EASE_OUT } from "@/components/motion";

export type CompleteAction = (formData: FormData) => void | Promise<void>;

export function CountUp({ to, className }: { to: number; className?: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, to, { duration: 0.9, ease: EASE_OUT, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [to, reduce]);
  return <span className={className}>{reduce ? to : n}</span>;
}

// A quiz the student actually answers: tap an option, press Check, get
// green/red feedback plus a hint when wrong.
export function MockQuestion({
  prompt,
  options,
  correct,
  hint,
  onChecked,
  checkLabel = "Check",
}: {
  prompt: string;
  options: string[];
  correct: number;
  hint: string;
  onChecked?: (ok: boolean) => void;
  checkLabel?: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<"ok" | "bad" | null>(null);

  function check() {
    if (picked === null) return;
    const ok = picked === correct;
    setResult(ok ? "ok" : "bad");
    onChecked?.(ok);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-base font-medium text-foreground">{prompt}</p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Answers">
        {options.map((o, i) => {
          const selected = picked === i;
          const state =
            result && selected
              ? result === "ok"
                ? "border-success bg-success/10 text-success-ink"
                : "border-error bg-error/10 text-error-ink"
              : selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-foreground hover:border-primary";
          return (
            <motion.button
              key={o}
              type="button"
              role="radio"
              aria-checked={selected}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              onClick={() => {
                setPicked(i);
                setResult(null);
              }}
              className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border px-3 py-2 font-[family-name:var(--font-mono)] text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${state}`}
            >
              {o}
              {result && selected && (result === "ok" ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />)}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <motion.p
          key={result ?? "idle"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          role="status"
          className={`text-sm ${result === "ok" ? "text-success-ink" : result === "bad" ? "text-error-ink" : "text-muted"}`}
        >
          {result === "ok" ? "Correct. Nicely done." : result === "bad" ? `Not quite. Hint: ${hint}` : "Pick an answer, then press Check."}
        </motion.p>
        <button
          type="button"
          onClick={check}
          disabled={picked === null}
          className="shrink-0 rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          {checkLabel}
        </button>
      </div>
    </div>
  );
}
