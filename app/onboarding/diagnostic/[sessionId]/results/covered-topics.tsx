"use client";

import { useState } from "react";
import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { Check } from "lucide-react";
import { startRecapDiagnosticAction } from "@/app/actions/diagnostic";
import { Button } from "@/components/button";
import { PendingAiOverlay } from "@/components/pending-ai-overlay";
import { EASE_OUT } from "@/components/motion";
import { RECAP_MAX_TOPICS } from "@/lib/diagnostic-select";
import type { UntestedGroup } from "@/lib/supabase/untested-topics";

export function CoveredTopics({ groups }: { groups: UntestedGroup[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const full = picked.length >= RECAP_MAX_TOPICS;
  const toggle = (v: string) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.length >= RECAP_MAX_TOPICS ? p : [...p, v]));

  return (
    <MotionConfig reducedMotion="user">
      <form action={startRecapDiagnosticAction} className="flex flex-col gap-5">
        <PendingAiOverlay
          title="Building your quiz"
          messages={["Looking at what you picked…", "Writing a few questions on each…", "Nearly there…"]}
        />
        <div className="flex flex-col gap-1">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
            Have you already covered any of these?
          </h2>
          <p className="text-sm text-muted">
            Tick up to {RECAP_MAX_TOPICS} topics you&apos;ve done before and we&apos;ll check what stuck.
          </p>
        </div>
        {groups.map((g) => (
          <fieldset key={g.subjectId} className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-medium text-foreground">{g.subjectName}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.topics.map((t) => {
                const value = `${g.subjectId}::${t.name}`;
                const on = picked.includes(value);
                const id = `covered-${t.id}`;
                return (
                  <div key={t.id}>
                    <input
                      id={id}
                      type="checkbox"
                      name="topic"
                      value={value}
                      checked={on}
                      disabled={!on && full}
                      onChange={() => toggle(value)}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={id}
                      className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-base text-foreground transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${
                        on ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/50"
                      }`}
                    >
                      <span>{t.name}</span>
                      <motion.span
                        aria-hidden
                        animate={{ scale: on ? 1 : 0.9 }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          on ? "border-primary bg-primary text-white" : "border-border text-transparent"
                        }`}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </motion.span>
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-4" aria-live="polite">
          <Button type="submit" disabled={picked.length === 0}>
            {picked.length === 0 ? "Check what I know" : `Check what I know (${picked.length})`}
          </Button>
          <Link href="/dashboard" className="text-base font-medium text-muted underline-offset-4 hover:text-foreground hover:underline">
            Skip, I&apos;ll start from the beginning
          </Link>
          {full && <p className="text-sm text-muted">That&apos;s the most we can check at once.</p>}
        </div>
      </form>
    </MotionConfig>
  );
}
