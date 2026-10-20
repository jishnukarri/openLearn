"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Pencil, X } from "lucide-react";
import { Question } from "@/lib/supabase/questions";
import { updateQuestionVerificationAction } from "@/app/actions/subjects";
import { Button } from "@/components/button";
import { EASE_OUT } from "@/components/motion";

// Question bank checking, one question at a time. The old version listed
// every question inline, which was long and easy to skim past. Teachers now
// get a short summary in the page and a focused "check questions" screen:
// read it, say it's right (or fix it), move on.
export function AdminQuestionBankEditor({
  topicId,
  topicName,
  initialQuestions,
}: {
  topicId: string;
  topicName?: string;
  initialQuestions: Question[];
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const total = questions.length;
  const checked = questions.filter((q) => q.verified).length;
  const allChecked = total > 0 && checked === total;
  const current = questions[index];

  const openReview = (e: React.MouseEvent<HTMLElement>) => {
    openerRef.current = e.currentTarget;
    const firstUnchecked = questions.findIndex((q) => !q.verified);
    setIndex(firstUnchecked === -1 ? 0 : firstUnchecked);
    setEditing(false);
    setError(null);
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    setEditing(false);
    openerRef.current?.focus();
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setIndex(next);
      setEditing(false);
      setError(null);
    },
    [total]
  );

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      const typing = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (typing) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, close, go]);

  const save = async (verified: boolean, withEdits: boolean) => {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      await updateQuestionVerificationAction({
        questionId: current.id,
        verified,
        prompt: withEdits ? draftPrompt : undefined,
        modelAnswer: withEdits ? draftAnswer : undefined,
      });
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === current.id
            ? {
                ...q,
                verified,
                prompt: withEdits ? draftPrompt : q.prompt,
                model_answer: withEdits ? draftAnswer : q.model_answer,
              }
            : q
        )
      );
      setEditing(false);
      if (verified && index < total - 1) setIndex(index + 1);
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const startFix = () => {
    if (!current) return;
    setDraftPrompt(current.prompt);
    setDraftAnswer(current.model_answer);
    setEditing(true);
    setError(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-3" data-topic-id={topicId}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
              Practice questions
            </h3>
            <p className="text-sm text-muted">
              {total === 0
                ? "No practice questions have been made for this topic yet."
                : allChecked
                  ? `All ${total} questions checked.`
                  : `${checked} of ${total} questions checked. Students only see questions you've checked.`}
            </p>
          </div>
          {total > 0 && (
            <Button
              type="button"
              size="compact"
              variant={allChecked ? "secondary" : "primary"}
              className={allChecked ? "!shadow-none" : undefined}
              onClick={openReview}
            >
              {allChecked ? "Look over again" : checked === 0 ? "Start checking" : "Keep checking"}
            </Button>
          )}
        </div>

        {total > 0 && (
          <div
            role="progressbar"
            aria-label="Questions checked"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={checked}
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <motion.div
              className="h-full origin-left rounded-full bg-success"
              initial={false}
              animate={{ width: `${(checked / total) * 100}%` }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && current && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:p-6"
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="qb-title"
              tabIndex={-1}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex w-full max-w-6xl flex-col overflow-hidden bg-background outline-none sm:rounded-3xl sm:border sm:border-border"
            >
              <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
                <div className="min-w-0">
                  <h2 id="qb-title" className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground sm:text-2xl">
                    Check practice questions
                  </h2>
                  <p className="truncate text-sm text-muted">
                    {topicName ? `${topicName} · ` : ""}Question {index + 1} of {total} · {checked} checked
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close and keep my progress"
                  className="flex shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  <X className="size-4" strokeWidth={2} />
                  <span className="hidden sm:inline">Done for now</span>
                </button>
              </header>

              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <nav
                  aria-label="Questions"
                  className="flex shrink-0 gap-2 overflow-x-auto border-b border-border p-3 lg:w-72 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4"
                >
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => go(i)}
                      aria-current={i === index ? "step" : undefined}
                      className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        i === index ? "bg-surface text-foreground" : "text-muted hover:bg-surface/60 hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          q.verified ? "bg-success text-white" : "border border-border text-muted"
                        }`}
                      >
                        {q.verified ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="hidden min-w-0 flex-1 truncate lg:block">{q.prompt}</span>
                      <span className="sr-only">{q.verified ? "Checked" : "Not checked yet"}</span>
                    </button>
                  ))}
                </nav>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`${current.id}-${editing}`}
                        initial={{ opacity: 0, x: 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                        className="mx-auto flex max-w-2xl flex-col gap-8"
                      >
                        {editing ? (
                          <>
                            <div className="flex flex-col gap-2">
                              <label htmlFor="qb-prompt" className="text-base font-semibold text-foreground">
                                The question
                              </label>
                              <textarea
                                id="qb-prompt"
                                rows={4}
                                value={draftPrompt}
                                onChange={(e) => setDraftPrompt(e.target.value)}
                                className="rounded-xl border border-border bg-surface p-3 text-base text-foreground"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label htmlFor="qb-answer" className="text-base font-semibold text-foreground">
                                The correct answer
                              </label>
                              <textarea
                                id="qb-answer"
                                rows={4}
                                value={draftAnswer}
                                onChange={(e) => setDraftAnswer(e.target.value)}
                                className="rounded-xl border border-border bg-surface p-3 text-base text-foreground"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-3">
                                <h3 className="text-sm font-semibold text-muted">The question</h3>
                                {current.verified && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-sm font-medium text-success">
                                    <CircleCheck className="size-4" strokeWidth={2.25} /> Checked
                                  </span>
                                )}
                              </div>
                              <p className="font-[family-name:var(--font-display)] text-2xl leading-snug text-foreground sm:text-3xl">
                                {current.prompt}
                              </p>
                              <p className="text-sm text-muted">Worth {current.max_marks} {current.max_marks === 1 ? "mark" : "marks"}</p>
                            </div>

                            <div className="flex flex-col gap-2">
                              <h3 className="text-sm font-semibold text-muted">The correct answer</h3>
                              <p className="max-w-[60ch] text-lg text-foreground">{current.model_answer}</p>
                              {current.format?.type === "numeric" && (
                                <p className="text-base text-muted">
                                  Marked as a number: {current.format.answer}
                                  {current.format.unit ? ` ${current.format.unit}` : ""}
                                  {typeof current.format.tolerancePercent === "number"
                                    ? `, accepted within ${current.format.tolerancePercent}%`
                                    : ""}
                                  {typeof current.format.sigFigs === "number"
                                    ? `, ${current.format.sigFigs} significant figures`
                                    : ""}
                                  . To change the number, regenerate the question.
                                </p>
                              )}
                            </div>

                            {current.markscheme.length > 0 && (
                              <div className="flex flex-col gap-2">
                                <h3 className="text-sm font-semibold text-muted">A student earns a mark for</h3>
                                <ul className="flex flex-col gap-2">
                                  {current.markscheme.map((m, i) => (
                                    <li key={i} className="flex max-w-[60ch] items-start gap-2 text-base text-foreground">
                                      <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />
                                      {m.point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <footer className="border-t border-border bg-surface px-5 py-4 sm:px-10 lg:px-14">
                    <div className="mx-auto flex max-w-2xl flex-col gap-3">
                      <AnimatePresence>
                        {error && (
                          <motion.p
                            role="alert"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-sm text-error"
                          >
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      {editing ? (
                        <div className="flex flex-wrap gap-3">
                          <Button type="button" disabled={saving || !draftPrompt.trim() || !draftAnswer.trim()} onClick={() => save(true, true)}>
                            {saving ? "Saving…" : "Save and mark as checked"}
                          </Button>
                          <Button type="button" variant="secondary" className="!shadow-none" disabled={saving} onClick={() => setEditing(false)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          {current.verified ? (
                            <Button type="button" variant="secondary" className="!shadow-none" disabled={saving} onClick={() => save(false, false)}>
                              Not right after all
                            </Button>
                          ) : (
                            <Button type="button" disabled={saving} onClick={() => save(true, false)}>
                              {saving ? "Saving…" : index < total - 1 ? "This is right, next" : "This is right"}
                            </Button>
                          )}
                          <Button type="button" variant="secondary" className="!shadow-none" disabled={saving} onClick={startFix}>
                            <Pencil className="mr-2 size-4" strokeWidth={2} />
                            Change it
                          </Button>
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Previous question"
                              disabled={index === 0}
                              onClick={() => go(index - 1)}
                              className="flex size-10 items-center justify-center rounded-full border border-border text-muted transition-colors hover:text-foreground disabled:opacity-40"
                            >
                              <ArrowLeft className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Next question"
                              disabled={index === total - 1}
                              onClick={() => go(index + 1)}
                              className="flex size-10 items-center justify-center rounded-full border border-border text-muted transition-colors hover:text-foreground disabled:opacity-40"
                            >
                              <ArrowRight className="size-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {allChecked && !editing && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-2 text-sm font-medium text-success"
                        >
                          <CircleCheck className="size-4" strokeWidth={2.25} />
                          All {total} questions are checked. You can close this.
                        </motion.p>
                      )}
                    </div>
                  </footer>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
