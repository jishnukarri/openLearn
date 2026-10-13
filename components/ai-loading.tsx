"use client";

import { useEffect, useState } from "react";

const DEFAULT_MESSAGES = [
  "Reading the topic…",
  "Breaking it into bite-sized steps…",
  "Writing your examples…",
  "Drawing diagrams…",
  "Setting up quick checks…",
  "Nearly there…",
];

// Full "the AI is building this for you" loading screen. Used by route-level
// loading.tsx files (streamed instantly while the server generates) and as a
// pending overlay for form actions. Deliberately CSS-only (no react-spring)
//, this is the one screen that must never fail to show, and a JS-driven
// spring style that doesn't settle is a real, confirmed way for content to
// stay invisible on some mobile rendering paths. Plain CSS animations can't
// get stuck like that.
export function AiLoading({
  title = "Building your lesson",
  messages = DEFAULT_MESSAGES,
  overlay = false,
}: {
  title?: string;
  messages?: string[];
  overlay?: boolean;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1 < messages.length ? i + 1 : i)),
      2200
    );
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        overlay
          ? "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background/95 backdrop-blur-sm"
          : "mx-auto flex min-h-[70dvh] max-w-2xl flex-col items-center justify-center gap-8 px-6"
      }
    >
      <div
        className="h-24 w-24 animate-pulse rounded-full bg-[radial-gradient(circle_at_30%_30%,color-mix(in_srgb,var(--primary)_55%,var(--foreground)),var(--primary)_60%,color-mix(in_srgb,var(--primary)_60%,var(--background)))] shadow-[0_0_50px_-8px_color-mix(in_srgb,var(--primary)_60%,transparent)]"
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          {title}
        </p>
        <div className="relative flex h-6 items-center justify-center">
          <p key={index} className="animate-fade-slide-up text-sm text-muted">
            {messages[index]}
          </p>
        </div>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3" aria-hidden>
        <div className="h-4 w-2/5 animate-pulse rounded-full bg-surface" />
        <div className="h-3 w-full animate-pulse rounded-full bg-surface [animation-delay:150ms]" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-surface [animation-delay:300ms]" />
        <div className="h-16 w-full animate-pulse rounded-xl bg-surface [animation-delay:450ms]" />
      </div>
    </div>
  );
}
