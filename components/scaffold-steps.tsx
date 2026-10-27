"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { Check } from "lucide-react";
import { checkScaffoldStepAction } from "@/app/actions/practice";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { Banner } from "@/components/question-feedback";
import { EASE_OUT } from "@/components/motion";
import type { ScaffoldStep } from "@/lib/question-remediation";

const inputClass =
  "min-h-11 min-w-0 rounded-2xl border border-border bg-surface px-4 py-2 font-mono text-xl text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";

// Prompts may reference earlier answers as {1}, {2}... (1-based step number).
function fillPrompt(prompt: string, accepted: string[]): string {
  return prompt.replace(/\{(\d+)\}/g, (m, n) => accepted[Number(n) - 1] ?? m);
}

function FractionInput({
  top,
  bottom,
  onTop,
  onBottom,
  disabled,
  topRef,
}: {
  top: string;
  bottom: string;
  onTop: (v: string) => void;
  onBottom: (v: string) => void;
  disabled?: boolean;
  topRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div role="group" aria-label="Fraction" className="flex w-28 flex-col items-stretch gap-1">
      <input
        ref={topRef}
        aria-label="Top (numerator)"
        inputMode="decimal"
        autoComplete="off"
        value={top}
        disabled={disabled}
        onChange={(e) => onTop(e.target.value)}
        className={`${inputClass} text-center`}
      />
      <div aria-hidden className="h-0.5 w-full rounded bg-foreground" />
      <input
        aria-label="Bottom (denominator)"
        inputMode="decimal"
        autoComplete="off"
        value={bottom}
        disabled={disabled}
        onChange={(e) => onBottom(e.target.value)}
        className={`${inputClass} text-center`}
      />
    </div>
  );
}

// Graded steps for procedural questions. Steps reveal one at a time, accepted
// steps lock with a tick, and there is deliberately no skip. The last step is
// the original question's answer; getting it right calls onComplete.
export function ScaffoldSteps({
  questionId,
  steps,
  onComplete,
}: {
  questionId: string;
  steps: ScaffoldStep[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const [wrongHint, setWrongHint] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  const step = steps[index];

  // Focus the first field of each newly revealed step, and after "Try again".
  useEffect(() => {
    if (!wrong) inputRef.current?.focus();
  }, [index, wrong]);

  if (!step && !done) return null;

  const answer = step?.kind === "fraction" ? (top.trim() && bottom.trim() ? `${top.trim()}/${bottom.trim()}` : "") : value.trim();

  async function check() {
    if (!answer || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await checkScaffoldStepAction({ questionId, stepIndex: index, answer });
      if (res.correct) {
        setAccepted((a) => [...a, answer]);
        setWrong(false);
        setWrongHint(null);
        setValue("");
        setTop("");
        setBottom("");
        if (index === steps.length - 1) {
          setDone(true);
          onComplete();
        } else {
          setIndex((i) => i + 1);
        }
      } else {
        setWrong(true);
        setWrongHint(res.hint ?? null);
      }
    } catch {
      setError("Couldn't check that. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  function tryAgain() {
    setWrong(false);
    setWrongHint(null);
    setValue("");
    setTop("");
    setBottom("");
  }

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby={headingId} className="flex flex-col gap-4">
        <h3 id={headingId} className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          Let&apos;s break it down
        </h3>

        <ol className="flex flex-col gap-4">
          {accepted.map((a, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-foreground">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-3.5" strokeWidth={3} aria-label="Done" />
              </span>
              <div className="min-w-0">
                <p>
                  <RichText text={fillPrompt(steps[i].prompt, accepted)} />
                </p>
                <p className="mt-1 font-mono text-lg">
                  {a}
                  {steps[i].unit ? ` ${steps[i].unit}` : ""}
                </p>
              </div>
            </li>
          ))}

          {step && (
            <motion.li
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="flex flex-col gap-3"
            >
              <p className="font-[family-name:var(--font-mono)] text-sm text-highlight">
                Step {index + 1} of {steps.length}
              </p>
              <p className="text-base text-foreground">
                <RichText text={fillPrompt(step.prompt, accepted)} />
              </p>

              {step.kind === "fraction" ? (
                <FractionInput
                  topRef={inputRef}
                  top={top}
                  bottom={bottom}
                  onTop={setTop}
                  onBottom={setBottom}
                  disabled={wrong || checking}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    aria-label={`Answer for step ${index + 1}`}
                    inputMode={step.kind === "numeric" ? "decimal" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    value={value}
                    disabled={wrong || checking}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void check();
                      }
                    }}
                    className={`${inputClass} w-full max-w-xs`}
                  />
                  {step.unit && <span className="text-base text-muted">{step.unit}</span>}
                </div>
              )}

              <div aria-live="polite" className="flex flex-col gap-3">
                {wrong && (
                  <Banner tone="error">
                    Not quite.
                    {wrongHint && (
                      <span className="mt-1 block font-normal text-foreground">
                        <RichText text={wrongHint} />
                      </span>
                    )}
                  </Banner>
                )}
                {error && <p className="text-base text-error">{error}</p>}
              </div>

              {wrong ? (
                <Button type="button" className="min-h-11 self-start" onClick={tryAgain}>
                  Try again
                </Button>
              ) : (
                <Button
                  type="button"
                  className="min-h-11 self-start"
                  onClick={check}
                  disabled={!answer || checking}
                >
                  {checking ? "Checking…" : "Check"}
                </Button>
              )}
            </motion.li>
          )}
        </ol>

        {done && (
          <div aria-live="polite">
            <Banner tone="success">You worked it out</Banner>
          </div>
        )}
      </section>
    </MotionConfig>
  );
}
