"use client";

import { useState } from "react";
import {
  skipDiagnosticAction,
  startFreshDiagnosticAction,
} from "@/app/actions/diagnostic";
import { PendingAiOverlay } from "@/components/pending-ai-overlay";
import { Button } from "@/components/button";

function StartForm({ scope }: { scope: "quick" | "full" }) {
  return (
    <form action={startFreshDiagnosticAction}>
      <PendingAiOverlay
        title="Preparing your diagnostic"
        messages={[
          "Looking at your subjects…",
          "Picking the right questions…",
          "Balancing the difficulty…",
          "Nearly there…",
        ]}
      />
      <input type="hidden" name="scope" value={scope} />
      <Button type="submit" className="w-full" variant={scope === "full" ? "secondary" : undefined}>
        {scope === "quick" ? "Start quick check" : "Do the full diagnostic"}
      </Button>
    </form>
  );
}

export function DiagnosticForms({
  subjectCount,
  hasFirstTopics,
}: {
  subjectCount: number;
  hasFirstTopics: boolean;
}) {
  const [showFull, setShowFull] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
      {/* Quick option, always shown */}
      <div className="flex flex-col gap-1">
        <StartForm scope="quick" />
        <p className="text-xs text-muted">
          {hasFirstTopics
            ? `~${subjectCount * 3}–${subjectCount * 5} questions covering the first topic of each subject. Takes about 5 minutes.`
            : `A short mixed quiz on each subject, about 5 minutes.`}
        </p>
      </div>

      {/* Full option, reveal on tap */}
      {!showFull ? (
        <button
          type="button"
          onClick={() => setShowFull(true)}
          className="text-xs text-muted underline text-left hover:text-foreground transition-colors"
        >
          Want to cover all your topics at once?
        </button>
      ) : (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <StartForm scope="full" />
          <p className="text-xs text-muted">
            Covers every topic across all your subjects, a longer session
            but gives us a much more detailed picture. Worth it if you have
            20–30 minutes now.
          </p>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <form action={skipDiagnosticAction}>
          <Button type="submit" variant="secondary" className="w-full !shadow-none">
            Skip, I&apos;ll figure it out as I go
          </Button>
        </form>
        <p className="text-xs text-muted mt-2">
          Skipping means we&apos;ll assume you&apos;re starting fresh. The
          quiz takes about five minutes and helps us avoid teaching things
          you already know.
        </p>
      </div>
    </div>
  );
}
