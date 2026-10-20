"use client";

import { useEffect, useMemo, useState } from "react";
import type { LessonCheck } from "@/lib/ai/lessons";
import { answersMatch } from "@/lib/question-marking";
import { Button } from "@/components/button";
import { OptionButton } from "@/components/option-button";
import { RichText } from "@/components/rich-text";
import { MatchingBoard } from "@/components/matching-board";
import { ExplainBox } from "@/components/explain-box";
import { explainCheckAnswerAction } from "@/app/actions/lessons";
import { seededShuffle, shuffleOptions } from "@/lib/shuffle";

const MCQ_LABELS = ["A", "B", "C", "D", "E"];

export function QuickCheck({
  check,
  onResult,
  revealed,
  onDraft,
  seed = "check",
}: {
  check: LessonCheck;
  // Seed for this attempt: new attempt or revisit gives a new option order.
  seed?: string;
  onResult: (correct: boolean, el: HTMLElement, picked?: string) => void;
  revealed: boolean;
  onDraft?: (hasDraft: boolean) => void;
}) {
  switch (check.kind) {
    case "multi":
      return <MultiCheck check={check} onResult={onResult} revealed={revealed} onDraft={onDraft} seed={seed} />;
    case "short":
      return <ShortCheck check={check} onResult={onResult} revealed={revealed} onDraft={onDraft} seed={seed} />;
    case "matching":
      return <MatchingCheck check={check} onResult={onResult} revealed={revealed} onDraft={onDraft} seed={seed} />;
    default:
      return <McqCheck check={check} onResult={onResult} revealed={revealed} onDraft={onDraft} seed={seed} />;
  }
}

type ResultProps = {
  onResult: (correct: boolean, el: HTMLElement, picked?: string) => void;
  revealed: boolean;
  onDraft?: (hasDraft: boolean) => void;
  seed: string;
};

// Tells the step whether the student has picked/typed something yet.
function useDraft(onDraft: ((d: boolean) => void) | undefined, has: boolean) {
  useEffect(() => {
    onDraft?.(has);
  }, [onDraft, has]);
}

function McqCheck({
  check,
  onResult,
  revealed,
  seed,
}: ResultProps & {
  check: Extract<LessonCheck, { correctIndex: number }>;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  // Displayed order for this attempt; correctIndex follows the shuffle.
  const view = useMemo(() => shuffleOptions(check.question, check.options, seed), [check.question, check.options, seed]);
  const correctShown = view.position[check.correctIndex];
  const wrong = revealed && picked !== null && picked !== correctShown;
  return (
    <div className="flex flex-col gap-2">
      {view.options.map((option, idx) => {
        const isCorrect = idx === correctShown;
        const state = revealed
          ? isCorrect
            ? "correct"
            : picked === idx
              ? "incorrect"
              : "default"
          : picked === idx
            ? "selected"
            : "default";
        return (
          <OptionButton
            key={idx}
            state={state}
            disabled={revealed}
            label={MCQ_LABELS[idx]}
            onClick={(el) => {
              setPicked(idx);
              onResult(isCorrect, el, option);
            }}
          >
            <RichText text={option} />
          </OptionButton>
        );
      })}
      {wrong && (
        <ExplainButton
          question={check.question}
          correctAnswer={check.options[check.correctIndex]}
        />
      )}
    </div>
  );
}

function MultiCheck({
  check,
  onResult,
  revealed,
  onDraft,
  seed,
}: ResultProps & {
  check: Extract<LessonCheck, { kind: "multi" }>;
}) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  useDraft(onDraft, picked.size > 0);
  const view = useMemo(() => shuffleOptions(check.question, check.options, seed), [check.question, check.options, seed]);
  const correct = new Set(check.correctIndexes.map((i) => view.position[i]));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">You can pick more than one.</p>
      {view.options.map((option, idx) => {
        const isSelected = picked.has(idx);
        const isCorrect = correct.has(idx);
        let style = isSelected
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-foreground";
        if (revealed && isCorrect) {
          style = "border-success bg-success/10 text-success";
        } else if (revealed && isSelected && !isCorrect) {
          style = "border-error bg-error/10 text-error";
        }
        return (
          <button
            key={idx}
            type="button"
            disabled={revealed}
            onClick={() =>
              setPicked((prev) => {
                const nextSet = new Set(prev);
                if (nextSet.has(idx)) nextSet.delete(idx);
                else nextSet.add(idx);
                return nextSet;
              })
            }
            className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${style}`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-3xs font-bold ${
                isSelected || (revealed && isCorrect)
                  ? "border-current"
                  : "border-muted/40 text-muted"
              }`}
            >
              {MCQ_LABELS[idx]}
            </span>
            <RichText text={option} />
          </button>
        );
      })}
      {!revealed && (
        <CheckButton
          disabledReason={picked.size === 0 ? "Pick at least one answer first" : null}
          onCheck={(el) => {
            const right =
              picked.size === correct.size &&
              [...picked].every((i) => correct.has(i));
            onResult(right, el);
          }}
        />
      )}
    </div>
  );
}

function ShortCheck({
  check,
  onResult,
  revealed,
  onDraft,
  seed,
}: ResultProps & {
  check: Extract<LessonCheck, { kind: "short" }>;
}) {
  const [text, setText] = useState("");
  useDraft(check.wordBank && check.wordBank.length > 0 ? undefined : onDraft, text.trim().length > 0);
  // Word bank mode: tappable tiles build the answer (no typing)
  if (check.wordBank && check.wordBank.length > 0) {
    return (
      <WordBankCheck
        check={check as Extract<LessonCheck, { kind: "short" }> & { wordBank: string[] }}
        onResult={onResult}
        revealed={revealed}
        onDraft={onDraft}
        seed={seed}
      />
    );
  }

  // Fallback: text input for lessons without a word bank
  const right = check.accepted.some((a) => answersMatch(text, a));

  return (
    <div className="flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={revealed}
        placeholder="Type your answer..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !revealed && text.trim()) {
            onResult(right, e.currentTarget);
          }
        }}
        className={`min-h-11 rounded-xl border p-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          revealed
            ? right
              ? "border-success bg-success/10"
              : "border-error bg-error/10"
            : "border-border bg-background"
        }`}
      />
      {!revealed && (
        <CheckButton
          disabledReason={text.trim() ? null : "Type your answer first"}
          onCheck={(el) => onResult(right, el)}
        />
      )}
    </div>
  );
}

function WordBankCheck({
  check,
  onResult,
  revealed,
  onDraft,
  seed,
}: ResultProps & {
  check: Extract<LessonCheck, { kind: "short" }> & { wordBank: string[] };
}) {
  const [selected, setSelected] = useState<string[]>([]);
  useDraft(onDraft, selected.length > 0);
  const assembled = selected.join(" ");
  const right = check.accepted.some((a) => answersMatch(assembled, a));

  // Seeded per attempt so the tiles move on retry but never between renders.
  const shuffled = useMemo(() => seededShuffle(check.wordBank, seed), [check.wordBank, seed]);

  function toggleWord(word: string) {
    if (revealed) return;
    setSelected((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Answer assembly tray */}
      <div
        className={`min-h-12 rounded-xl border-2 p-3 text-sm flex flex-wrap items-center gap-1.5 transition-colors ${
          revealed
            ? right
              ? "border-success bg-success/10"
              : "border-error bg-error/10"
            : "border-border bg-background border-dashed"
        }`}
      >
        {selected.length > 0 ? (
          selected.map((word, i) => (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() =>
                setSelected((prev) => {
                  const next = [...prev];
                  next.splice(i, 1);
                  return next;
                })
              }
              className="min-h-9 rounded-lg border border-primary bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/20 disabled:cursor-default"
            >
              {word}
            </button>
          ))
        ) : (
          <span className="text-muted text-sm">Tap words below to build your answer</span>
        )}
      </div>

      {/* Word bank tiles */}
      <div className="flex flex-wrap gap-2">
        {shuffled.map((word, i) => {
          const isUsed = selected.includes(word);
          return (
            <button
              key={i}
              type="button"
              disabled={revealed || isUsed}
              onClick={() => toggleWord(word)}
              className={`min-h-11 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all active:scale-95 ${
                isUsed
                  ? "border-border bg-background text-muted opacity-30 cursor-default"
                  : "border-border bg-surface text-foreground hover:border-primary hover:bg-primary/5"
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>

      {!revealed && (
        <CheckButton
          disabledReason={selected.length === 0 ? "Tap some words first" : null}
          onCheck={(el) => onResult(right, el)}
        />
      )}
    </div>
  );
}

function MatchingCheck({
  check,
  onResult,
  revealed,
  onDraft,
  seed,
}: ResultProps & {
  check: Extract<LessonCheck, { kind: "matching" }>;
}) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const shuffledRights = useMemo(
    () => seededShuffle(check.pairs.map((pair, index) => ({ label: pair.right, index })), seed),
    [check.pairs, seed]
  );
  const allPicked = check.pairs.every((_, i) => picks[i] !== undefined);
  useDraft(onDraft, Object.keys(picks).length > 0);
  const correctRightIndex = (leftIndex: number) =>
    shuffledRights.findIndex((r) => r.index === leftIndex);

  return (
    <div className="flex flex-col gap-3">
      <MatchingBoard
        lefts={check.pairs.map((p) => p.left)}
        rights={shuffledRights}
        value={picks}
        onChange={setPicks}
        revealed={revealed}
        correctRightIndex={correctRightIndex}
      />
      {!revealed && (
        <CheckButton
          disabledReason={allPicked ? null : "Match every item first"}
          onCheck={(el) => {
            const right = check.pairs.every(
              (_, i) => shuffledRights[picks[i]]?.index === i
            );
            onResult(right, el);
          }}
        />
      )}
    </div>
  );
}

function ExplainButton({ question, correctAnswer }: { question: string; correctAnswer: string }) {
  return (
    <ExplainBox
      fetchExplanation={() => explainCheckAnswerAction({ question, correctAnswer })}
    />
  );
}

// The one "Check my answer" button for typed/multi/matching checks. When it
// cannot be pressed it says why, right beside it, instead of just greying out.
function CheckButton({
  onCheck,
  disabledReason,
}: {
  onCheck: (el: HTMLElement) => void;
  disabledReason: string | null;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        onClick={(e) => onCheck(e.currentTarget)}
        disabled={disabledReason !== null}
        aria-describedby={disabledReason ? "check-reason" : undefined}
        className="min-h-11"
      >
        Check my answer
      </Button>
      {disabledReason && (
        <span id="check-reason" className="text-sm text-muted">
          {disabledReason}
        </span>
      )}
    </div>
  );
}
