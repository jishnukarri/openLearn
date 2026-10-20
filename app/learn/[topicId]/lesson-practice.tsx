"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import type { LessonPractice } from "@/lib/lesson-personalise";

// Post-teaching practice from questions the student already has history with.
// No marking call: they think, reveal the model answer, then say how they did.
export function LessonPracticeStep({
  practice,
  instruction,
  onDone,
}: {
  practice: LessonPractice;
  instruction: string;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [rated, setRated] = useState<"got" | "not" | null>(null);
  const item = practice.items[idx];
  const last = idx === practice.items.length - 1;

  function advance() {
    if (last) { onDone(); return; }
    setIdx(idx + 1);
    setShown(false);
    setRated(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[65ch] text-base font-medium leading-snug text-foreground">{instruction}</p>
      <p className="text-sm text-muted">{practice.reason}</p>
      <p className="text-sm font-medium text-muted" aria-live="polite">
        Question {idx + 1} of {practice.items.length}
      </p>
      <p className="font-[family-name:var(--font-display)] text-2xl leading-snug text-foreground sm:text-3xl">
        <RichText text={item.prompt} />
      </p>
      {!shown ? (
        <div className="flex flex-col items-start gap-1.5">
          <Button className="min-h-12 px-8" onClick={() => setShown(true)}>Show the answer</Button>
          <p className="text-sm text-muted">Think of your answer first, then check it against this one.</p>
        </div>
      ) : (
        <div className="animate-fade-slide-up rounded-xl border-2 border-primary/30 bg-primary/5 p-4" role="group" aria-label="Model answer">
          <p className="mb-2 text-base font-semibold text-foreground">Model answer</p>
          <p className="mb-3 text-base text-foreground"><RichText text={item.modelAnswer} /></p>
          {item.points.length > 0 && (
            <ul className="mb-4 list-disc pl-5 text-sm text-foreground">
              {item.points.map((p, i) => <li key={i}><RichText text={p} /></li>)}
            </ul>
          )}
          <p className="mb-2 text-sm font-medium text-foreground">How did you do?</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant={rated === "got" ? "primary" : "secondary"}
              className="min-h-11 px-5"
              aria-pressed={rated === "got"}
              onClick={() => setRated("got")}
            >
              {rated === "got" && <Check className="mr-1 size-4" aria-hidden="true" />}I got it
            </Button>
            <Button
              variant={rated === "not" ? "primary" : "secondary"}
              className="min-h-11 px-5"
              aria-pressed={rated === "not"}
              onClick={() => setRated("not")}
            >
              Not quite
            </Button>
          </div>
          {rated && (
            <div className="mt-4">
              <Button className="min-h-12 px-8" onClick={advance}>{last ? "Got it, next" : "Next question"}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
