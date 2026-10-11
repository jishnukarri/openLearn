"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import {
  skipDiagnosticAction,
  startFreshDiagnosticAction,
} from "@/app/actions/diagnostic";
import { PendingAiOverlay } from "@/components/pending-ai-overlay";
import { Button } from "@/components/button";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

function StartForm({ scope, label, secondary }: { scope: "quick" | "full"; label: string; secondary?: boolean }) {
  return (
    <form action={startFreshDiagnosticAction} className="w-full">
      <PendingAiOverlay
        title="Preparing your diagnostic"
        messages={[
          "Looking at your subjects…",
          "Picking the right questions…",
          "Balancing the difficulty…",
          "Nearly there…",
        ]}
      />
      <input type="hidden" name="scope" value={scope} />
      <Button type="submit" className="w-full" variant={secondary ? "secondary" : undefined}>
        {label}
      </Button>
    </form>
  );
}

export function DiagnosticForms({
  subjectNames,
  subjectCount,
  hasFirstTopics,
}: {
  subjectNames: string;
  subjectCount: number;
  hasFirstTopics: boolean;
}) {
  const [showFull, setShowFull] = useState(false);
  const reduce = useReducedMotion();

  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.5, delayChildren: 0.15 } } }}
      className="flex flex-col gap-6"
    >
      <motion.div variants={item} className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-[family-name:var(--font-display)] text-base font-semibold text-white"
        >
          o
        </span>
        <div className="rounded-2xl rounded-tl-sm bg-surface px-5 py-4">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug text-foreground">
            Want to take a quick diagnostic before we start?
          </h1>
        </div>
      </motion.div>

      <motion.p variants={item} className="max-w-[60ch] pl-12 text-sm text-muted">
        A short quiz on {subjectNames} shows us what you already know, so we
        teach the right things first instead of guessing.{" "}
        {hasFirstTopics
          ? `About ${subjectCount * 3}–${subjectCount * 5} questions, roughly 5 minutes.`
          : "About 5 minutes."}
      </motion.p>

      <motion.div variants={item} className="flex flex-col gap-3 pl-12 sm:max-w-sm">
        <StartForm scope="quick" label="Yes, let's do it" />
        <form action={skipDiagnosticAction}>
          <Button type="submit" variant="secondary" className="w-full !shadow-none">
            Not now, take me to my dashboard
          </Button>
        </form>

        <AnimatePresence initial={false} mode="wait">
          {!showFull ? (
            <motion.button
              key="more"
              type="button"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowFull(true)}
              className="self-start text-left text-sm text-muted underline transition-colors hover:text-foreground"
            >
              Want to cover all your topics at once?
            </motion.button>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="flex flex-col gap-2 overflow-hidden"
            >
              <StartForm scope="full" label="Do the full diagnostic" secondary />
              <p className="max-w-[60ch] text-sm text-muted">
                Covers every topic across all your subjects. A longer session
                (20–30 minutes) but a much more detailed picture.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
