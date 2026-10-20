"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { ButtonLink } from "@/components/button";

type Item = { key: string; title: string; description: string; href: string; minutes: number; done: boolean };

export function GettingStarted({ items, nextKey }: { items: Item[]; nextKey: string | null }) {
  const [open, setOpen] = useState(true);
  const done = items.filter((i) => i.done).length;

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="Getting started">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Getting started{" "}
          <span className="font-[family-name:var(--font-mono)] text-muted">
            {done}/{items.length}
          </span>
          <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="mt-3 flex flex-col divide-y divide-border overflow-hidden border-y border-border"
            >
              {items.map((item) => (
                <li key={item.key} className="flex items-center gap-3 py-3">
                  <span
                    aria-hidden
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                      item.done ? "border-success bg-success" : "border-border"
                    }`}
                  >
                    {item.done && (
                      <motion.svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: EASE_OUT }} />
                      </motion.svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-base font-medium ${item.done ? "text-muted line-through" : "text-foreground"}`}>
                      {item.title}
                      <span className="sr-only">{item.done ? " (done)" : ""}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {item.description} {!item.done && `About ${item.minutes} min.`}
                    </p>
                  </div>
                  {item.key === nextKey ? (
                    <ButtonLink href={item.href} size="compact">Start</ButtonLink>
                  ) : (
                    !item.done && (
                      <Link href={item.href} className="shrink-0 text-sm font-medium text-primary hover:underline">
                        Start
                      </Link>
                    )
                  )}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}
