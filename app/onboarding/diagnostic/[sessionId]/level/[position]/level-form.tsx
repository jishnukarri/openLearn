"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { submitDiagnosticLevelAction } from "@/app/actions/diagnostic";
import { AiLoading } from "@/components/ai-loading";
import { Button } from "@/components/button";
import { OptionButton } from "@/components/option-button";
import { TextInput, TextArea } from "@/components/text-input";
import { NumericAnswer } from "@/components/numeric-answer";
import { MatchingBoard } from "@/components/matching-board";
import { RichText } from "@/components/rich-text";
import type { ClientDiagnosticQuestion } from "@/lib/diagnostic-client";
import type { LevelAnswerPayload } from "@/lib/diagnostic-scoring";

function PendingOverlay({ isLast }: { isLast: boolean }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <AiLoading
      overlay
      title={isLast ? "Marking your diagnostic…" : "Saving your answer…"}
      messages={
        isLast
          ? ["Reviewing all your answers…", "Almost there…"]
          : ["Saving…"]
      }
    />
  );
}

export function LevelForm({
  sessionId,
  position,
  isLast,
  question,
  action = submitDiagnosticLevelAction,
  backHref,
}: {
  sessionId: string;
  position: number;
  isLast: boolean;
  question: ClientDiagnosticQuestion;
  // Guest diagnostics (no account yet) submit through a different action
  // and live under a different URL — see app/start/diagnostic/*.
  action?: (formData: FormData) => void | Promise<void>;
  backHref?: string;
}) {
  const [mcqIndex, setMcqIndex] = useState<number | null>(null);
  const [blankText, setBlankText] = useState("");
  const [shortAnswer, setShortAnswer] = useState("");
  const [matches, setMatches] = useState<Record<number, number>>({});

  const payload: LevelAnswerPayload = {
    mcqIndex: mcqIndex ?? undefined,
    blankText: blankText || undefined,
    shortAnswer: shortAnswer || undefined,
    matches:
      question.type === "match"
        ? question.lefts.map((_, i) =>
            matches[i] !== undefined ? question.rights[matches[i]].index : -1
          )
        : undefined,
  };

  const canSubmit =
    question.type === "mcq"
      ? mcqIndex !== null
      : question.type === "fill_blank"
        ? blankText.trim().length > 0
        : question.type === "numeric"
          ? blankText.trim().length > 0
          : question.type === "short_answer"
          ? shortAnswer.trim().length > 0
          : question.type === "match"
            ? question.lefts.every((_, i) => matches[i] !== undefined)
            : false;

  return (
    <form action={action} className="flex flex-col gap-6">
      <PendingOverlay isLast={isLast} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="position" value={position} />
      <input type="hidden" name="answerPayload" value={JSON.stringify(payload)} />

      {question.type === "mcq" && (
        <div className="flex flex-col gap-2">
          {question.options.map((option, idx) => (
            <OptionButton
              key={idx}
              state={mcqIndex === idx ? "selected" : "default"}
              onClick={() => setMcqIndex(idx)}
            >
              <RichText text={option} />
            </OptionButton>
          ))}
        </div>
      )}

      {question.type === "fill_blank" && (() => {
        // The AI is instructed to write the prompt with a literal "___"
        // blank — split on that and embed the input right where it was,
        // instead of showing the question text separately from an
        // unrelated textbox below it. Falls back to the old separate
        // layout if a question was generated without exactly one blank.
        const parts = question.prompt.split(/_{3,}/);
        if (parts.length !== 2) {
          return (
            <>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground lg:text-3xl">
                {question.prompt}
              </h1>
              <TextInput
                value={blankText}
                onChange={(e) => setBlankText(e.target.value)}
                placeholder="Fill in the blank"
              />
            </>
          );
        }
        const [before, after] = parts;
        return (
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground lg:text-3xl">
              <span>{before}</span>
              <input
                value={blankText}
                onChange={(e) => setBlankText(e.target.value)}
                placeholder="type here"
                size={Math.max(6, blankText.length || 10)}
                className="inline-block rounded-md border border-dashed border-primary bg-primary/10 px-2 py-0.5 align-baseline font-[family-name:var(--font-sans)] text-lg font-medium text-primary placeholder:text-primary/50 outline-none focus-visible:bg-primary/15"
              />
              <span>{after}</span>
            </p>
            <p className="text-sm text-muted">Type your answer into the blank above.</p>
          </div>
        );
      })()}

      {question.type === "numeric" && (
        <NumericAnswer value={blankText} onChange={setBlankText} unit={question.unit} />
      )}

      {question.type === "match" && (
        <MatchingBoard
          lefts={question.lefts}
          rights={question.rights}
          value={matches}
          onChange={setMatches}
          revealed={false}
        />
      )}

      {question.type === "short_answer" && (
        <TextArea
          value={shortAnswer}
          onChange={(e) => setShortAnswer(e.target.value)}
          rows={5}
          placeholder="Write your answer..."
        />
      )}

      <div className="flex items-center gap-2">
        {position > 0 && (
          <Link
            href={backHref ?? `/onboarding/diagnostic/${sessionId}/level/${position - 1}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
            Back
          </Link>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {isLast ? "Finish" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
