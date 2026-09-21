"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/button";

// Shared error.tsx UI for every AI-generation route (lesson/practice/
// flashcards/diagnostic). Next.js renders this instead of crashing the
// whole page when generation throws, a provider outage or exhausted API
// quota shouldn't ever surface a raw stack trace to a student.
export function AiErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AI generation failed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-3xl">⚠️</p>
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        Couldn&apos;t reach the AI right now
      </h1>
      <p className="text-sm text-muted">
        This is usually temporary, the AI provider may be busy or briefly
        unavailable. Try again in a moment.
      </p>
      <div className="mt-2 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-3 text-sm font-medium text-muted hover:text-foreground"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
