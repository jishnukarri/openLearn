"use client";

import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { Trophy, Check, Play, Lock } from "lucide-react";
import { EASE_OUT } from "@/components/motion";

export type PathUnit = {
  id: string;
  name: string;
  href: string;
  diagnosticScore?: number | null;
};

const NODE = 44;

// A small horizontal bar showing diagnostic strength (0-100%).
// Only rendered when diagnosticScore is not null.
function StrengthBattery({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-highlight" : "bg-error";
  return (
    <div className="flex items-center gap-2" title={`Diagnostic: ${pct}%`}>
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted">{pct}% diagnostic</span>
    </div>
  );
}

// A vertical unit timeline: completed units are filled and clickable, the
// next unit up is highlighted and clickable, everything after that is locked
// until the student reaches it.
export function SubjectPath({
  units,
  completedIds,
}: {
  units: PathUnit[];
  completedIds: string[];
}) {
  const completed = new Set(completedIds);
  const firstIncompleteIndex = units.findIndex((u) => !completed.has(u.id));
  const allDone = firstIncompleteIndex === -1;

  return (
    <MotionConfig reducedMotion="user">
      <ol className="relative flex flex-col">
        {/* The drawn timeline spine, behind the nodes. */}
        <motion.span
          aria-hidden
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          style={{ left: NODE / 2 - 1, top: NODE / 2, bottom: NODE / 2 }}
          className="absolute w-0.5 origin-top bg-border"
        />
        {units.map((unit, i) => {
          const isDone = completed.has(unit.id);
          const isCurrent = i === firstIncompleteIndex;
          const isLocked = !isDone && !isCurrent;

          const node = (
            <span
              style={{ width: NODE, height: NODE }}
              className={`relative z-[1] flex shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                isDone
                  ? "border-success bg-success text-white"
                  : isCurrent
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-background text-muted"
              }`}
            >
              {isDone ? (
                <Check className="size-5" strokeWidth={2.5} aria-hidden />
              ) : isLocked ? (
                <Lock className="size-4" strokeWidth={2.2} aria-hidden />
              ) : (
                <Play className="size-5" strokeWidth={2} fill="currentColor" aria-hidden />
              )}
            </span>
          );

          const label = (
            <span className="flex min-w-0 flex-col gap-1">
              <span className={`text-base font-medium ${isLocked ? "text-muted" : "text-foreground"}`}>
                {unit.name}
              </span>
              <span className="text-sm text-muted">
                {isDone ? "Complete" : isCurrent ? "Up next" : "Locked until you reach it"}
              </span>
              {unit.diagnosticScore != null && <StrengthBattery score={unit.diagnosticScore} />}
            </span>
          );

          return (
            <motion.li
              key={unit.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.08 + Math.min(i, 8) * 0.05 }}
            >
              {isLocked ? (
                <div className="flex items-start gap-4 py-3">
                  {node}
                  {label}
                </div>
              ) : (
                <Link
                  href={unit.href}
                  className="group flex items-start gap-4 py-3 outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-primary"
                >
                  {node}
                  {label}
                </Link>
              )}
            </motion.li>
          );
        })}

        {allDone && units.length > 0 && (
          <motion.li
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.5 }}
            className="flex items-center gap-4 py-3"
          >
            <span
              style={{ width: NODE, height: NODE }}
              className="relative z-[1] flex shrink-0 items-center justify-center rounded-full bg-highlight text-white"
            >
              <Trophy className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-base font-medium text-highlight">All units complete</span>
          </motion.li>
        )}
      </ol>
    </MotionConfig>
  );
}
