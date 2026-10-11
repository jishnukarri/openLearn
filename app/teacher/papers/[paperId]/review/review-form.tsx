"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { savePaperReviewAction } from "@/app/actions/papers";
import type { PaperQuestion } from "@/lib/supabase/papers";

type EditableQuestion = {
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
};

export function PaperReviewForm({
  paperId,
  initialQuestions,
}: {
  paperId: string;
  initialQuestions: PaperQuestion[];
}) {
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    initialQuestions.map((q) => ({
      questionNumber: q.questionNumber,
      prompt: q.prompt,
      maxMarks: q.maxMarks,
      markscheme: q.markscheme.map((m) => ({ point: m.point })),
    }))
  );

  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updatePoint(qIndex: number, pIndex: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, markscheme: q.markscheme.map((m, j) => (j === pIndex ? { point: value } : m)) }
          : q
      )
    );
  }

  function addPoint(qIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qIndex ? { ...q, markscheme: [...q.markscheme, { point: "" }] } : q))
    );
  }

  function removePoint(qIndex: number, pIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, markscheme: q.markscheme.filter((_, j) => j !== pIndex) } : q
      )
    );
  }

  return (
    <form action={savePaperReviewAction} className="flex flex-col gap-6">
      <input type="hidden" name="paperId" value={paperId} />
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      {questions.map((q, qIndex) => (
        <div key={qIndex} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Question #
              <input
                type="number"
                value={q.questionNumber}
                onChange={(e) => updateQuestion(qIndex, { questionNumber: Number(e.target.value) })}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Max marks
              <input
                type="number"
                value={q.maxMarks}
                onChange={(e) => updateQuestion(qIndex, { maxMarks: Number(e.target.value) })}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-muted">
            Prompt
            <textarea
              value={q.prompt}
              onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
              rows={3}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Markscheme points</span>
            {q.markscheme.map((m, pIndex) => (
              <div key={pIndex} className="flex items-center gap-2">
                <input
                  value={m.point}
                  onChange={(e) => updatePoint(qIndex, pIndex, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => removePoint(qIndex, pIndex)}
                  className="shrink-0 text-sm text-error hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addPoint(qIndex)}
              className="self-start text-sm text-primary hover:underline"
            >
              + Add point
            </button>
          </div>
        </div>
      ))}

      <Button type="submit" size="compact" className="self-start">
        Save &amp; finalize paper
      </Button>
    </form>
  );
}
