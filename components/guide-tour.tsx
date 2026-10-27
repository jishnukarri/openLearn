"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { Button } from "@/components/button";
import { SubmitButton } from "@/components/submit-button";
import { tourKeyDelta } from "@/lib/tour-keys";

export type TourStep = {
  id: string;
  heading: string;
  body: string;
  // Label of the primary button: says what happens next.
  cta: string;
  content: ReactNode;
};

export function GuideTour({
  pieceKey,
  steps,
  completeAction,
  completeLabel = "Mark as complete",
}: {
  pieceKey: string;
  steps: TourStep[];
  completeAction: (formData: FormData) => void | Promise<void>;
  completeLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const last = index === steps.length - 1;
  const step = steps[index];

  const go = useCallback(
    (delta: number) => {
      setDir(delta);
      setIndex((i) => Math.min(steps.length - 1, Math.max(0, i + delta)));
    },
    [steps.length]
  );

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land on the content (not the initial render).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const delta = tourKeyDelta({ ...e, key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, defaultPrevented: e.defaultPrevented, target: e.target as HTMLElement | null });
      if (delta) go(delta);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-3">
          <ol className="flex items-center gap-2" aria-label="Progress">
            {steps.map((s, i) => (
              <li key={s.id} aria-current={i === index ? "step" : undefined}>
                <span
                  className={`block h-2 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                    i === index ? "w-6 bg-primary" : i < index ? "w-2 bg-primary/50" : "w-2 bg-border"
                  }`}
                />
                <span className="sr-only">
                  Step {i + 1} of {steps.length}
                </span>
              </li>
            ))}
          </ol>
          <Link href="/dashboard" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
            Skip for now
          </Link>
        </div>

        <div aria-live="polite" className="min-h-[26rem]">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.section
              key={step.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="flex flex-col gap-5"
              aria-label={`Step ${index + 1} of ${steps.length}: ${step.heading}`}
            >
              <div>
                <h1 ref={headingRef} tabIndex={-1} className="outline-none font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground">
                  {step.heading}
                </h1>
                <p className="mt-2 text-base text-muted">{step.body}</p>
              </div>
              <div>{step.content}</div>
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-0"
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back
          </button>
          {last ? (
            <form action={completeAction}>
              <input type="hidden" name="piece" value={pieceKey} />
              <SubmitButton className="gap-2" pendingText="Saving…">
                <Check className="size-4" strokeWidth={2.5} aria-hidden /> {completeLabel}
              </SubmitButton>
            </form>
          ) : (
            <Button type="button" onClick={() => go(1)}>
              {step.cta}
            </Button>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}
