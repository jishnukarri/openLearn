"use client";

import { useState } from "react";
import type { LessonSection } from "@/lib/ai/lessons";
import { QuickCheck } from "@/app/learn/[topicId]/quick-check";
import { RichText } from "@/components/rich-text";

// 1. Step-reveal (IKEA effect: step-by-step worked calculations / historical steps)
export function StepReveal({
  title,
  steps,
  onComplete,
}: {
  title: string;
  steps: { label: string; detail: string }[];
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h4 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
          {title}
        </h4>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs text-primary">
          Step {currentStep + 1} of {steps.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {steps.slice(0, currentStep + 1).map((step, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 transition-all duration-300 ${
              idx === currentStep
                ? "border-primary/40 bg-primary/5 shadow-sm"
                : "border-border bg-background opacity-80"
            }`}
          >
            <p className="text-xs font-semibold text-foreground">{step.label}</p>
            <p className="mt-1 text-xs text-muted leading-relaxed">{step.detail}</p>
          </div>
        ))}
      </div>

      <button
        onClick={handleNext}
        className="mt-2 self-end rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
      >
        {currentStep < steps.length - 1 ? "Got it, next step →" : "Complete recap ✓"}
      </button>
    </div>
  );
}

// A clarification must repair the misconception before asking the learner to
// recall it again. Reusing the original section check keeps the activity tied
// to the exact idea they missed instead of asking them to recognise a heading.
export function ClarificationCard({
  section,
  onComplete,
}: {
  section: LessonSection;
  onComplete: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Key idea</p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          <RichText text={section.explanation} />
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">See it in action</p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          <RichText text={section.example} />
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Now try the idea again
        </p>
        <QuickCheck
          key={attempt}
          check={section.check}
          revealed={revealed}
          onResult={(correct) => {
            setRevealed(true);
            if (correct) onComplete();
          }}
        />
      </div>

      {revealed && (
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            setAttempt((value) => value + 1);
          }}
          className="self-start rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-foreground"
        >
          Try the question again
        </button>
      )}
    </div>
  );
}

// 3. Sort-order (Competence feedback: reorder chronological / logical steps)
export function SortOrder({
  title,
  initialItems,
  correctOrder,
  onComplete,
}: {
  title: string;
  initialItems: string[];
  correctOrder: string[];
  onComplete: () => void;
}) {
  const [items, setItems] = useState<string[]>(initialItems);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setItems(updated);
    setSubmitted(false);
  };

  const handleCheck = () => {
    const correct = items.every((item, idx) => item === correctOrder[idx]);
    setSubmitted(true);
    setIsCorrect(correct);
    if (correct) {
      setTimeout(() => onComplete(), 1000);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h4 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
        {title}
      </h4>
      <p className="text-xs text-muted">Arrange these steps into the correct sequence:</p>

      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <div
            key={item}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-xs text-foreground"
          >
            <span className="font-[family-name:var(--font-mono)] text-muted">{idx + 1}.</span>
            <span className="flex-1 font-medium">{item}</span>
            <div className="flex gap-1">
              <button
                disabled={idx === 0}
                onClick={() => moveItem(idx, idx - 1)}
                className="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface disabled:opacity-30"
              >
                ↑
              </button>
              <button
                disabled={idx === items.length - 1}
                onClick={() => moveItem(idx, idx + 1)}
                className="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        {submitted && (
          <p className={`text-xs font-medium ${isCorrect ? "text-success" : "text-error"}`}>
            {isCorrect ? "Perfect sequence!" : "Sequence isn't quite right. Adjust and check again."}
          </p>
        )}
        <button
          onClick={handleCheck}
          className="ml-auto rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Check order ✓
        </button>
      </div>
    </div>
  );
}

// 4. Match-connect (Goal gradient: pair terms and definitions)
export function MatchConnect({
  pairs,
  onComplete,
}: {
  pairs: { term: string; definition: string }[];
  onComplete: () => void;
}) {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});

  const handleTermClick = (term: string) => {
    if (matched[term]) return;
    setSelectedTerm(term);
  };

  const handleDefinitionClick = (definition: string) => {
    if (!selectedTerm) return;
    const targetPair = pairs.find((p) => p.term === selectedTerm);
    if (targetPair && targetPair.definition === definition) {
      const updated = { ...matched, [selectedTerm]: definition };
      setMatched(updated);
      setSelectedTerm(null);
      if (Object.keys(updated).length === pairs.length) {
        setTimeout(() => onComplete(), 1000);
      }
    } else {
      setSelectedTerm(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-xs font-medium text-muted">Tap a term on the left, then tap its matching definition on the right</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {pairs.map((p) => {
            const isMatched = !!matched[p.term];
            const isSelected = selectedTerm === p.term;
            return (
              <button
                key={p.term}
                onClick={() => handleTermClick(p.term)}
                disabled={isMatched}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                  isMatched
                    ? "border-success/40 bg-success/10 text-success opacity-60"
                    : isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-foreground hover:border-primary"
                }`}
              >
                {p.term} {isMatched && "✓"}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          {pairs.map((p) => {
            const isMatched = Object.values(matched).includes(p.definition);
            return (
              <button
                key={p.definition}
                onClick={() => handleDefinitionClick(p.definition)}
                disabled={isMatched}
                className={`rounded-xl border p-3 text-left text-xs transition-all ${
                  isMatched
                    ? "border-success/40 bg-success/10 text-success opacity-60"
                    : "border-border bg-background text-foreground hover:border-primary"
                }`}
              >
                {p.definition} {isMatched && "✓"}
              </button>
            );
          })}
        </div>
      </div>
      {Object.keys(matched).length === pairs.length && (
        <p className="text-xs font-semibold text-success">All pairs matched perfectly!</p>
      )}
    </div>
  );
}
