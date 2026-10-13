"use client";

import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { Check, Layers, Play, RotateCcw, Trophy } from "lucide-react";
import { EASE_OUT } from "@/components/motion";

export type PathUnit = {
  id: string;
  name: string;
  href: string;
  kind: "topic" | "subtopic";
  diagnosticScore?: number | null;
  masteryScore?: number | null;
};

export type PathGroup = {
  id: string;
  name: string;
  summary: string | null;
  lessons: PathUnit[];
};

const NODE = 40;

function StrengthBattery({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-highlight" : "bg-error";
  return (
    <div className="flex items-center gap-2" title={`Mastery: ${pct}%`}>
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-muted">{pct}% mastery</span>
    </div>
  );
}

// One path, grouped by unit (topic). Every lesson is open. A finished lesson
// gets revision actions (recall cards and exam questions) that earn more XP,
// so revising is part of the path, not a separate tab.
export function SubjectPath({
  groups,
  completedIds,
}: {
  groups: PathGroup[];
  completedIds: string[];
}) {
  const completed = new Set(completedIds);
  const all = groups.flatMap((g) => g.lessons);
  const nextId = all.find((u) => !completed.has(u.id))?.id;
  const allDone = all.length > 0 && !nextId;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-12">
        {groups.map((group, gi) => {
          const done = group.lessons.filter((l) => completed.has(l.id)).length;
          return (
            <motion.section
              key={group.id}
              aria-labelledby={`unit-${group.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT, delay: Math.min(gi, 6) * 0.06 }}
              className="flex flex-col gap-4"
            >
              <header className="flex flex-col gap-2 border-b border-border pb-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2
                    id={`unit-${group.id}`}
                    className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground"
                  >
                    {group.name}
                  </h2>
                  <p className="font-[family-name:var(--font-mono)] text-sm text-muted">
                    {done} of {group.lessons.length} {group.lessons.length === 1 ? "lesson" : "lessons"}
                  </p>
                </div>
                {group.summary && <p className="max-w-[65ch] text-sm text-muted line-clamp-2">{group.summary}</p>}
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-highlight transition-[width] duration-500"
                    style={{ width: `${group.lessons.length ? (done / group.lessons.length) * 100 : 0}%` }}
                  />
                </div>
              </header>

              <ol className="relative flex flex-col">
                <span
                  aria-hidden
                  style={{ left: NODE / 2 - 1, top: NODE / 2, bottom: NODE / 2 }}
                  className="absolute w-0.5 bg-border"
                />
                {group.lessons.map((unit) => {
                  const isDone = completed.has(unit.id);
                  const isNext = unit.id === nextId;
                  const base = unit.kind === "subtopic" ? "subtopic/" : "";
                  return (
                    <li key={unit.id} className="py-2.5">
                      <div className="flex items-start gap-4">
                        <Link
                          href={unit.href}
                          aria-label={`${isDone ? "Open" : "Start"} ${unit.name}`}
                          style={{ width: NODE, height: NODE }}
                          className={`relative z-[1] flex shrink-0 items-center justify-center rounded-full border-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                            isDone
                              ? "border-success bg-success text-white"
                              : isNext
                                ? "border-primary bg-primary text-white"
                                : "border-border bg-background text-muted hover:border-primary/60"
                          }`}
                        >
                          {isDone ? (
                            <Check className="size-5" strokeWidth={2.5} aria-hidden />
                          ) : (
                            <Play className="size-4" strokeWidth={2} fill="currentColor" aria-hidden />
                          )}
                        </Link>

                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <Link href={unit.href} className="w-fit text-base font-medium text-foreground hover:underline">
                            {unit.name}
                          </Link>
                          <p className="text-sm text-muted">{isDone ? "Complete" : isNext ? "Up next" : "Not started"}</p>
                          {unit.masteryScore != null && <StrengthBattery score={unit.masteryScore} />}

                          {isDone && (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Link
                                href={`/flashcards/${base}${unit.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary"
                              >
                                <Layers className="size-4" strokeWidth={2} aria-hidden /> Recall it
                              </Link>
                              <Link
                                href={`/practice/${base}${unit.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary"
                              >
                                <RotateCcw className="size-4" strokeWidth={2} aria-hidden /> Exam questions
                              </Link>
                              <span className="text-sm text-highlight">Earn more XP</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </motion.section>
          );
        })}

        {allDone && (
          <div className="flex items-center gap-4">
            <span
              style={{ width: NODE, height: NODE }}
              className="flex shrink-0 items-center justify-center rounded-full bg-highlight text-white"
            >
              <Trophy className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-base font-medium text-highlight">All lessons complete. Keep revising to earn more XP.</p>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
