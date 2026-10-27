"use client";

import { motion } from "framer-motion";
import { Flame, Zap } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { GuideTour, type TourStep } from "@/components/guide-tour";
import { CountUp, type CompleteAction } from "./parts";

function Overview() {
  const rows = [
    { icon: Zap, tone: "text-highlight-ink", label: "XP", text: "Points you earn for finishing lessons and practice." },
    { icon: Flame, tone: "text-secondary", label: "Streak", text: "Days in a row you study. Miss a day and it restarts." },
  ];
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <motion.div
          key={r.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.1 + i * 0.12 }}
          className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
        >
          <r.icon className={`mt-0.5 size-5 shrink-0 ${r.tone}`} strokeWidth={2} aria-hidden />
          <div>
            <p className="text-base font-semibold text-foreground">
              {r.label}
              {r.label === "XP" && <span className="ml-2 font-[family-name:var(--font-mono)] text-highlight-ink">+<CountUp to={20} /></span>}
            </p>
            <p className="text-sm text-muted">{r.text}</p>
          </div>
        </motion.div>
      ))}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-base font-semibold text-foreground">Mastery</p>
        <p className="text-sm text-muted">How well you know each topic, based on your answers. It rises as you practise.</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background" role="img" aria-label="Mastery rising to 70 percent">
          <motion.div
            initial={{ width: "10%" }}
            animate={{ width: "70%" }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.5 }}
            className="h-full rounded-full bg-highlight"
          />
        </div>
      </div>
    </div>
  );
}

const STEPS: TourStep[] = [
  { id: "overview", heading: "XP, streak and mastery", body: "Three numbers that show how you are doing.", cta: "Got it", content: <Overview /> },
  {
    id: "ready",
    heading: "You're ready",
    body: "Check your numbers any time on your dashboard.",
    cta: "Finish",
    content: <p className="text-base text-foreground">Study a little each day. Small, steady sessions grow all three.</p>,
  },
];

export function XpTour({ completeAction }: { completeAction: CompleteAction }) {
  return <GuideTour pieceKey="how-xp-works" steps={STEPS} completeAction={completeAction} />;
}
