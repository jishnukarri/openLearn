"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";

type AnswerFormat = "number" | "fraction" | "expression" | undefined;

type Props = {
  answer: string;
  onAnswerChange: (value: string) => void;
  answerFormat?: AnswerFormat;
  unit?: string;
  showWorkingSteps: boolean;
  workingSteps: string[];
  onWorkingStepsChange: (steps: string[]) => void;
};

type FieldTarget = "answer" | { kind: "step"; index: number };

const KEYPAD = [
  "7",
  "8",
  "9",
  "÷",
  "4",
  "5",
  "6",
  "×",
  "1",
  "2",
  "3",
  "-",
  "0",
  ".",
  "/",
  "+",
];

export function MathAnswerComposer({
  answer,
  onAnswerChange,
  answerFormat,
  unit,
  showWorkingSteps,
  workingSteps,
  onWorkingStepsChange,
}: Props) {
  const answerRef = useRef<HTMLInputElement | null>(null);
  const stepRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const [activeTarget, setActiveTarget] = useState<FieldTarget>("answer");
  const [fractionTop, setFractionTop] = useState("");
  const [fractionBottom, setFractionBottom] = useState("");
  const [powerBase, setPowerBase] = useState("");
  const [powerExponent, setPowerExponent] = useState("");

  const canUseFractionBuilder = answerFormat === "fraction";
  const canUsePowerBuilder = answerFormat === "expression";

  const workingRows = useMemo(
    () => (showWorkingSteps ? workingSteps : []),
    [showWorkingSteps, workingSteps]
  );

  function focusTarget(target: FieldTarget) {
    setActiveTarget(target);
    if (target === "answer") {
      answerRef.current?.focus();
      return;
    }
    stepRefs.current[target.index]?.focus();
  }

  function insertIntoTextField(
    current: string,
    next: string,
    selectionStart: number | null | undefined,
    selectionEnd: number | null | undefined
  ): string {
    if (selectionStart === null || selectionStart === undefined || selectionEnd === null || selectionEnd === undefined) {
      return `${current}${next}`;
    }
    return `${current.slice(0, selectionStart)}${next}${current.slice(selectionEnd)}`;
  }

  function insertToken(token: string) {
    if (activeTarget === "answer") {
      const input = answerRef.current;
      const next = insertIntoTextField(answer, token, input?.selectionStart, input?.selectionEnd);
      onAnswerChange(next);
      requestAnimationFrame(() => {
        const pos = (input?.selectionStart ?? answer.length) + token.length;
        input?.setSelectionRange(pos, pos);
      });
      return;
    }

    const index = activeTarget.index;
    const step = workingSteps[index] ?? "";
    const textarea = stepRefs.current[index];
    const next = insertIntoTextField(step, token, textarea?.selectionStart, textarea?.selectionEnd);
    const updated = [...workingSteps];
    updated[index] = next;
    onWorkingStepsChange(updated);
    requestAnimationFrame(() => {
      const pos = (textarea?.selectionStart ?? step.length) + token.length;
      textarea?.setSelectionRange(pos, pos);
    });
  }

  function applyFractionBuilder() {
    const numerator = fractionTop.trim();
    const denominator = fractionBottom.trim();
    if (!numerator || !denominator) return;
    onAnswerChange(`${numerator}/${denominator}`);
    focusTarget("answer");
  }

  function applyPowerBuilder() {
    const base = powerBase.trim();
    const exponent = powerExponent.trim();
    if (!base || !exponent) return;
    onAnswerChange(`${base}^${exponent}`);
    focusTarget("answer");
  }

  function addWorkingStep() {
    onWorkingStepsChange([...workingSteps, ""]);
    focusTarget({ kind: "step", index: workingSteps.length });
  }

  function updateWorkingStep(index: number, value: string) {
    const updated = [...workingSteps];
    updated[index] = value;
    onWorkingStepsChange(updated);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            Final answer
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={answerRef}
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              onFocus={() => focusTarget("answer")}
              placeholder={
                answerFormat === "fraction"
                  ? "e.g. 3/10"
                  : answerFormat === "expression"
                    ? "e.g. 4^3 + √25"
                    : "Final answer..."
              }
              className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            {unit && (
              <span className="shrink-0 font-[family-name:var(--font-mono)] text-sm text-muted">
                {unit}
              </span>
            )}
          </div>

          {canUseFractionBuilder && (
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Fraction builder
              </p>
              <div className="flex items-center gap-3">
                <div className="flex w-24 flex-col items-stretch gap-2">
                  <input
                    value={fractionTop}
                    onChange={(e) => setFractionTop(e.target.value)}
                    placeholder="top"
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <div className="h-px bg-border" />
                  <input
                    value={fractionBottom}
                    onChange={(e) => setFractionBottom(e.target.value)}
                    placeholder="bottom"
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="button" size="compact" onClick={applyFractionBuilder}>
                    Use fraction
                  </Button>
                  <p className="text-2xs text-muted">
                    Enter the top and bottom, then tap use.
                  </p>
                </div>
              </div>
            </div>
          )}

          {canUsePowerBuilder && (
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Power builder
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={powerBase}
                  onChange={(e) => setPowerBase(e.target.value)}
                  placeholder="base"
                  className="w-24 rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span className="text-lg text-muted">^</span>
                <input
                  value={powerExponent}
                  onChange={(e) => setPowerExponent(e.target.value)}
                  placeholder="power"
                  className="w-24 rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <Button type="button" size="compact" onClick={applyPowerBuilder}>
                  Use power
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Maths keypad
          </p>
          <div className="grid grid-cols-4 gap-2">
            {KEYPAD.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => insertToken(key)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              onClick={() => insertToken("^")}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
            >
              ^n
            </button>
            <button
              type="button"
              onClick={() => insertToken("√")}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
            >
              √
            </button>
            <button
              type="button"
              onClick={() => onAnswerChange("")}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onAnswerChange(answer.slice(0, -1))}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
            >
              ⌫
            </button>
          </div>
          <p className="mt-3 text-2xs text-muted">
            Tap into the answer box, then use the keypad if you want the easy button.
          </p>
        </div>
      </div>

      {showWorkingSteps && (
        <div className="rounded-2xl border border-dashed border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Working out
              </p>
              <p className="mt-1 text-xs text-muted">
                One line per step, like you would write on paper.
              </p>
            </div>
            <Button type="button" variant="secondary" size="compact" onClick={addWorkingStep}>
              Add step
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {workingRows.map((step, index) => (
              <div
                key={index}
                className="rounded-xl border border-border bg-surface p-3"
                onFocusCapture={() => focusTarget({ kind: "step", index })}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-mono)] text-xs text-muted">
                    Step {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = workingSteps.filter((_, i) => i !== index);
                      onWorkingStepsChange(updated);
                    }}
                    className="text-xs text-muted hover:text-error"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  ref={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  value={step}
                  onChange={(e) => updateWorkingStep(index, e.target.value)}
                  rows={2}
                  placeholder="Write this line of working..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
