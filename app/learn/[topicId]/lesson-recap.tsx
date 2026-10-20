"use client";

import { Check } from "lucide-react";

// "What did I just learn?" — one short line per idea the student has met.
export function RecapPanel({ items }: { items: { heading: string; line: string }[] }) {
  return (
    <section aria-label="Recap so far" className="animate-fade-slide-up border-b border-border bg-surface/60 px-4 py-4 sm:px-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">What you have learned so far</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.heading} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
              <Check className="size-3" strokeWidth={2.5} />
            </span>
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold">{it.heading}.</span> <span className="text-muted">{it.line}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// A single takeaway chip shown on a step once its idea has been taught.
export function TakeawayChip({ line }: { line: string }) {
  return (
    <p className="inline-flex max-w-[65ch] items-start gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-foreground">
      <span className="font-semibold text-primary">Remember:</span> {line}
    </p>
  );
}
