"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { shortReason } from "@/lib/feedback-summary";
import { RichText } from "@/components/rich-text";

// Result bar for a check: a one-line verdict plus a short reason, with the
// long explanation behind a "Why?" disclosure. On wide screens the detail
// slides in beside the verdict; on mobile it expands below. It never blocks
// the primary action, which the caller passes as children.
export function AnswerFeedback({
  correct,
  answerLabel,
  explanation,
  detail,
  children,
}: {
  correct: boolean;
  answerLabel: string;
  explanation: string;
  detail: ReactNode;
  children: ReactNode;
}) {
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reason = shortReason(explanation);

  return (
    <div
      className={`animate-fade-slide-up grid gap-6 rounded-b-2xl px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 ${
        correct ? "bg-success/10" : "bg-error/10"
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3" role="status">
          <span
            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-white ${
              correct ? "bg-success" : "bg-error"
            }`}
          >
            {correct ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : <X className="size-4" strokeWidth={2.5} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className={`text-lg font-semibold ${correct ? "text-success-ink" : "text-error-ink"}`}>
              {correct ? "Correct" : "Not quite"}
            </p>
            {!correct && answerLabel && (
              <p className="mt-0.5 text-base text-foreground">Answer: {answerLabel}</p>
            )}
            {reason && <p className="mt-1 max-w-[60ch] text-base leading-normal text-foreground">{reason}</p>}
          </div>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Why? See the full explanation
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
        </button>

        {children}
      </div>

      <div id={panelId} className="lg:row-start-1 lg:col-start-2">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="detail"
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: 24 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="rounded-xl bg-background p-5 text-base leading-relaxed text-foreground"
            >
              {detail}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function FeedbackDetailText({ explanation, example }: { explanation: string; example: string }) {
  return (
    <div className="flex max-w-[65ch] flex-col gap-3">
      <p><RichText text={explanation} /></p>
      <p className="text-muted"><RichText text={example} /></p>
    </div>
  );
}
