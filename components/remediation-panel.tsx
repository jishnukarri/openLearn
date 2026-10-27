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
}: {
  questionId: string;
  source: "hint" | "escalation";
  onLoaded?: (type: Remediation["type"] | "unavailable") => void;
  onComplete: () => void;
}) {
  const [rem, setRem] = useState<Remediation | "unavailable" | "error" | null>(null);

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
  }, [questionId]);

  if (rem === null) return <StatusLine text="Getting support ready…" />;
  if (rem === "unavailable" || rem === "error") {
    return (
      <p aria-live="polite" className="text-base text-muted">
        {rem === "error"
          ? "Couldn't load support. Please try again."
          : source === "hint"
            ? "No hint available for this question."
            : "No support available for this question."}
      </p>
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
