"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RichText } from "@/components/rich-text";
import { EASE_OUT } from "@/components/motion";

// Large, readable narration for a stepped worked example. The current step
// slides and fades in with a highlight sweep; earlier steps dim to 60% but
// stay fully legible. Reduced motion shows everything at once, no movement.
export function StepNarration({ steps, index }: { steps: string[]; index: number }) {
  const reduce = !!useReducedMotion();
  const total = steps.length;
  const current = Math.max(0, Math.min(total - 1, index));
  const earlier = reduce ? steps.slice(0, current) : steps.slice(0, current);

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {earlier.length > 0 && (
        <ol className="flex flex-col gap-2">
          {earlier.map((s, i) => (
            <li key={i} className="flex max-w-[60ch] items-start gap-3 text-base leading-normal text-foreground opacity-60 sm:text-lg">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-border text-xs font-semibold text-foreground">
                {i + 1}
              </span>
              <span><RichText text={s} /></span>
            </li>
          ))}
        </ol>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={reduce ? "static" : current}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -16 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          aria-current="step"
          className="relative rounded-xl bg-primary/10 text-left px-4 py-4 ring-1 ring-primary/30 sm:px-5"
        >
          {!reduce && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
              <motion.span
                className="absolute inset-y-0 left-0 block w-1/3 bg-primary/15"
                initial={{ x: "-100%", opacity: 1 }}
                animate={{ x: "400%", opacity: 0 }}
                transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 }}
              />
            </span>
          )}
          <p className="relative mb-2 inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-semibold text-white">
            Step {current + 1} of {total}
          </p>
          <p className="relative max-w-[60ch] break-words text-lg leading-normal text-foreground sm:text-xl">
            <RichText text={steps[current] ?? ""} />
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
