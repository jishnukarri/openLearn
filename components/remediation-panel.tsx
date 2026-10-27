"use client";

import { useEffect, useState } from "react";
import { getRemediationAction } from "@/app/actions/practice";
import { StatusLine } from "@/components/pending-status";
import { ScaffoldSteps } from "@/components/scaffold-steps";
import { ExplainRemediation } from "@/components/explain-remediation";
import type { Remediation } from "@/lib/question-remediation";

// Loads the cached remediation for a question and renders the right flavour:
// graded scaffold steps (procedural) or explain + reflect + transfer check.
export function RemediationPanel({
  questionId,
  source,
  onLoaded,
  onComplete,
  onClose,
}: {
  questionId: string;
  source: "hint" | "escalation";
  onLoaded?: (type: Remediation["type"] | "unavailable") => void;
  onComplete: () => void;
  /** Lets the student leave when support can't load, so they are never stuck. */
  onClose?: () => void;
}) {
  const [rem, setRem] = useState<Remediation | "unavailable" | "error" | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    getRemediationAction({ questionId })
      .then((res) => {
        if (!live) return;
        const next = "unavailable" in res ? "unavailable" : res;
        setRem(next);
        onLoaded?.(next === "unavailable" ? "unavailable" : next.type);
      })
      .catch(() => live && setRem("error"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, tries]);

  if (rem === null) return <StatusLine text="Getting support ready…" />;
  if (rem === "unavailable" || rem === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p aria-live="polite" className="text-base text-muted">
          {rem === "error"
            ? "Couldn't load support. Please try again."
            : source === "hint"
              ? "No hint available for this question."
              : "No support available for this question right now."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRem(null);
              setTries((t) => t + 1);
            }}
            className="min-h-11 rounded-2xl border border-border bg-surface px-5 text-sm font-semibold text-foreground hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Try again
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-2xl border border-border bg-surface px-5 text-sm font-semibold text-foreground hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {source === "hint" ? "Close" : "Move on, come back to it later"}
            </button>
          )}
        </div>
      </div>
    );
  }
  if (rem.type === "scaffold") {
    return <ScaffoldSteps questionId={questionId} steps={rem.steps} onComplete={onComplete} />;
  }
  return (
    <ExplainRemediation
      questionId={questionId}
      content={rem.content}
      scene={rem.scene}
      transferCheck={rem.transferCheck}
      onPassed={onComplete}
    />
  );
}
