"use client";

import { useFormStatus } from "react-dom";

// Small inline "working on it" line with pulsing dots. Reduced motion shows
// the dots static via motion-safe.
export function StatusLine({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted">
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
      {text}
    </p>
  );
}

// Drop inside a <form action>: shows the line only while that form is pending.
export function PendingStatus({ text }: { text: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <StatusLine text={text} />;
}
