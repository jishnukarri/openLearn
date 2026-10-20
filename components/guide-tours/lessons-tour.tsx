"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LifeBuoy, Zap } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { GuideTour, type TourStep } from "@/components/guide-tour";
import { CountUp, MockQuestion, type CompleteAction } from "./parts";

const PARTS = [
  ["Learn it", "A short explanation, one idea at a time."],
  ["See an example", "A worked answer, step by step."],
  ["Try it", "You answer a question yourself."],
  ["Check yourself", "A few questions to prove it stuck."],
] as const;

function Timeline() {
  return (
    <ol className="flex flex-col">
      {PARTS.map(([title, desc], i) => (
        <motion.li
          key={title}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.12 + i * 0.12 }}
          className="relative flex gap-4 pb-5 last:pb-0"
        >
          {i < PARTS.length - 1 && (
            <motion.span
              aria-hidden
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.25 + i * 0.12 }}
              style={{ originY: 0 }}
              className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border"
            />
          )}
          <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary bg-background font-[family-name:var(--font-mono)] text-sm font-semibold text-primary">
            {i + 1}
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted">{desc}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

function TryIt() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Mini lesson: what is a fraction of 12? One third of 12 means 12 split into 3 equal groups.</p>
      <MockQuestion
        prompt="What is 1/3 of 12?"
        options={["3", "4", "6"]}
        correct={1}
        hint="Split 12 into 3 equal groups. How many in one group?"
      />
    </div>
  );
}

function Help() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-base font-medium text-foreground">What is 1/4 of 12?</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <LifeBuoy className="size-4" strokeWidth={2} aria-hidden /> Stuck? Help
        </button>
        {!open && <span className="text-sm text-muted">Tap it to try.</span>}
      </div>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="mt-3 border-l-2 border-primary pl-3 text-sm text-foreground"
        >
          <p>You asked for help. Here is a nudge: split 12 into 4 equal groups and count one group.</p>
          <p className="mt-1 text-muted">Help explains in a different way and never just hands you the answer.</p>
        </motion.div>
      )}
    </div>
  );
}

function Xp() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-3xl font-semibold text-highlight">
        <Zap className="size-6" strokeWidth={2} aria-hidden /> +<CountUp to={20} /> XP
      </p>
      <ul className="text-sm text-muted">
        <li>Finish a lesson to earn XP.</li>
        <li>Topics fill up as you complete lessons, so you can see your path.</li>
      </ul>
    </div>
  );
}

function Ready() {
  return (
    <p className="text-base text-foreground">
      That is all of it. Open any topic from your dashboard whenever you are ready. You can replay this guide any time from
      Getting started.
    </p>
  );
}

const STEPS: TourStep[] = [
  { id: "parts", heading: "Every lesson has 4 parts", body: "Short and in the same order each time.", cta: "Show me how to try it", content: <Timeline /> },
  { id: "try", heading: "Try it yourself", body: "Pick an answer and press Check. Wrong answers are fine here.", cta: "Next: getting unstuck", content: <TryIt /> },
  { id: "help", heading: "Stuck? Ask for help", body: "The help button is always in the lesson.", cta: "Next: earning XP", content: <Help /> },
  { id: "xp", heading: "Progress earns XP", body: "Each finished lesson moves you forward.", cta: "Almost done", content: <Xp /> },
  { id: "ready", heading: "You're ready", body: "You know how a lesson works.", cta: "Finish", content: <Ready /> },
];

export function LessonsTour({ completeAction }: { completeAction: CompleteAction }) {
  return <GuideTour pieceKey="how-lessons-work" steps={STEPS} completeAction={completeAction} />;
}
