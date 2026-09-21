"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/button";

// Shared error.tsx UI for admin/teacher routes, where a failure is far more
// likely to be a database or permission error than an AI outage (unlike
// AiErrorScreen, used on the student-facing generation routes) — so the
// copy stays honest and general instead of blaming "the AI".
export function ActionErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Action failed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="size-8 text-error" strokeWidth={1.75} />
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="text-sm text-muted">
        {error.message || "That action couldn't be completed. Try again, or come back later."}
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
