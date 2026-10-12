"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check } from "lucide-react";
import { addSubjectsAction } from "@/app/actions/onboarding";
import { Button } from "@/components/button";
import { EASE_OUT } from "@/components/motion";

export type Option = {
  value: string;
  subject: string;
  board: string;
  topicCount: number;
  topicPreview: string[];
};

const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

// Subjects as large toggle cards (real checkboxes underneath, so keyboard and
// screen readers work natively), with a live summary that says exactly what
// pressing the button will do.
export function SubjectAdder({ options }: { options: Option[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const count = picked.length;

  return (
    <MotionConfig reducedMotion="user">
      <form action={addSubjectsAction} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Subjects you can add</legend>
          <motion.div
            variants={list}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"
          >
            {options.map((o) => {
              const on = picked.includes(o.value);
              const id = `add-${o.value}`;
              return (
                <motion.div key={o.value} variants={item}>
                  <input
                    id={id}
                    type="checkbox"
                    name="subjectExamBoard"
                    value={o.value}
                    checked={on}
                    onChange={() => toggle(o.value)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={id}
                    className={`flex min-h-44 cursor-pointer items-start justify-between gap-4 rounded-2xl border-2 p-5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${
                      on ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/50"
                    }`}
                  >
                    <span className="flex min-w-0 flex-col gap-2">
                      <span className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight text-foreground">
                        {o.subject}
                      </span>
                      <span className="text-sm font-medium text-muted">
                        {o.board} · {o.topicCount} {o.topicCount === 1 ? "topic" : "topics"}
                      </span>
                      {o.topicPreview.length > 0 && (
                        <span className="line-clamp-2 text-sm text-muted">
                          {o.topicPreview.join(", ")}
                          {o.topicCount > o.topicPreview.length ? "…" : ""}
                        </span>
                      )}
                    </span>
                    <motion.span
                      aria-hidden
                      animate={{ scale: on ? 1 : 0.9 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                        on ? "border-primary bg-primary text-white" : "border-border text-transparent"
                      }`}
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </motion.span>
                  </label>
                </motion.div>
              );
            })}
          </motion.div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4" aria-live="polite">
          <Button type="submit" disabled={count === 0} aria-describedby="add-help">
            {count === 0 ? "Add subjects" : `Add ${count} ${count === 1 ? "subject" : "subjects"}`}
          </Button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              id="add-help"
              key={count === 0 ? "none" : "some"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="text-sm text-muted"
            >
              {count === 0
                ? "Pick at least one to continue."
                : "Next is a short diagnostic on just the subjects you're adding."}
            </motion.p>
          </AnimatePresence>
        </div>
      </form>
    </MotionConfig>
  );
}
