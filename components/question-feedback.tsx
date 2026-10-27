"use client";

import { AnimatePresence, MotionConfig } from "framer-motion";
import { Check, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { Callout } from "@/components/callout";

export type FeedbackKind = "numeric" | "free-text";

export type FeedbackPoint = { point: string; comment: string; met: boolean };

// Phase names mirror lib/question-attempt-machine (AttemptPhase).
type Phase = "first-attempt" | "retry-1" | "second-chance" | "remediation" | "complete";

export function Banner({
  tone,
  children,
  id,
}: {
  tone: "error" | "neutral" | "success";
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Callout tone={tone} role="none" id={id}>
      {children}
    </Callout>
  );
}

// Escalating feedback after a wrong marked answer. Numeric questions only say
// "Incorrect" on the first miss (no hint, no mark scheme). Free-text shows
// per-part marks plus a "How to improve" box that becomes a model answer on
// the second miss. The live region is always mounted so updates are announced.
export function QuestionFeedback({
  phase,
  kind,
  marksAwarded,
  maxMarks,
  points,
  improveHint,
  modelAnswer,
  attempt,
  canSkip,
  onTryAgain,
  onSkip,
  onLearn,
  tryAgainDisabled,
}: {
  phase: Phase;
  kind: FeedbackKind;
  marksAwarded: number;
  maxMarks: number;
  points: FeedbackPoint[];
  improveHint?: string | null;
  modelAnswer?: string | null;
  attempt: 1 | 2;
  canSkip: boolean;
  onTryAgain: () => void;
  onSkip: () => void;
  onLearn: () => void;
  tryAgainDisabled?: boolean;
}) {
  const showSecond = phase === "second-chance";
  const escalating = phase === "remediation";
  const wrong = phase === "retry-1" || showSecond || escalating;

  return (
    <MotionConfig reducedMotion="user">
      <div aria-live="polite" className="flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {wrong && (
            <Banner key="verdict" tone="error">
              <span className="inline-flex items-center gap-2">
                <X className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                {kind === "numeric" ? "Incorrect" : "Not quite there yet"}
              </span>
            </Banner>
          )}
          {showSecond && (
            <Banner key="second" tone="neutral">
              Second chance! One more try…
            </Banner>
          )}
        </AnimatePresence>

        {wrong && kind === "free-text" && (
          <div className="flex flex-col gap-3">
            <p className="font-[family-name:var(--font-mono)] text-sm text-highlight-ink">
              {marksAwarded} out of {maxMarks} {maxMarks === 1 ? "mark" : "marks"}
            </p>
            {points.length > 0 && (
              <ul className="flex flex-col gap-2">
                {points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-base text-foreground">
                    {p.met ? (
                      <Check className="mt-1 size-4 shrink-0 text-success-ink" strokeWidth={2.5} aria-label="Earned" />
                    ) : (
                      <X className="mt-1 size-4 shrink-0 text-error-ink" strokeWidth={2.5} aria-label="Not earned" />
                    )}
                    <span>
                      <RichText text={p.point} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {attempt === 2 && modelAnswer ? (
              <div className="rounded-xl bg-primary/5 px-4 py-3">
                <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                  Model answer
                </h3>
                <p className="mt-1 text-base text-foreground">
                  <RichText text={modelAnswer} />
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-highlight/5 px-4 py-3">
                <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                  <Lightbulb className="size-4 text-highlight-ink" strokeWidth={2} aria-hidden />
                  How to improve
                </h3>
                <p className="mt-1 text-base text-foreground">
                  Look back at the question and add the missing points to your answer, using the key words from the
                  question.
                </p>
                {improveHint && (
                  <p className="mt-2 text-base text-foreground">
                    <RichText text={improveHint} />
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {wrong && (
          <div className="flex flex-wrap items-center gap-3">
            {escalating ? (
              <Button type="button" className="min-h-11" onClick={onLearn}>
                Let&apos;s learn it
              </Button>
            ) : (
              <>
                <Button type="button" className="min-h-11" onClick={onTryAgain} disabled={tryAgainDisabled}>
                  Try again
                </Button>
                {canSkip && (
                  <Button type="button" variant="secondary" className="min-h-11" onClick={onSkip}>
                    Skip
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
