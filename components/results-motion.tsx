"use client";

import { useEffect, useState } from "react";
import { MotionConfig, animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/components/motion";

// Counts up to a percentage so the headline number is earned, not dropped.
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    const unsub = mv.on("change", (v) => setShown(Math.round(v)));
    const controls = animate(mv, value, { duration: reduce ? 0 : 1.1, delay: 0.2, ease: EASE_OUT });
    return () => {
      unsub();
      controls.stop();
    };
  }, [mv, value, reduce]);

  return (
    <span className={className} aria-label={`${value} percent`}>
      {shown}
      <span className="text-[0.5em] text-muted">%</span>
    </span>
  );
}

const TONE_BAR = {
  success: "bg-success",
  highlight: "bg-highlight",
  error: "bg-error",
} as const;

// A thin bar that fills to the topic's score, one after another down the list.
export function ScoreBar({
  score,
  tone,
  delay = 0,
}: {
  score: number;
  tone: keyof typeof TONE_BAR;
  delay?: number;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div
        role="meter"
        aria-label="Topic score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(score * 100)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
      >
        <motion.div
          className={`h-full rounded-full ${TONE_BAR[tone]}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, Math.round(score * 100))}%` }}
          transition={{ duration: 0.8, delay: 0.4 + delay, ease: EASE_OUT }}
        />
      </div>
    </MotionConfig>
  );
}
