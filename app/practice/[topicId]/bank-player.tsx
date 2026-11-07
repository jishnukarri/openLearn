"use client";

import { useState, useEffect, useCallback, useReducer } from "react";
import { useActionState } from "react";
import { Check, X, Trophy, Camera, CheckCircle2, LoaderCircle } from "lucide-react";
import {
  submitBankAnswerAction,
  createBankSessionAction,
  completeBankSessionAction,
  explainPracticeAnswerAction,
  type PracticeState,
} from "@/app/actions/practice";
import {
  createPracticeUploadSessionAction,
  getPracticeUploadStatusAction,
  uploadPracticeImagesAction,
} from "@/app/actions/practice-uploads";
import { celebrate } from "@/lib/confetti";
import { Button } from "@/components/button";
import { StatusLine } from "@/components/pending-status";
import { RichText } from "@/components/rich-text";
import { MatchingBoard } from "@/components/matching-board";
import { ExplainBox } from "@/components/explain-box";
import { AnswerEditor } from "@/components/answer-editor";
import { NumericAnswer } from "@/components/numeric-answer";
import { MathAnswerComposer } from "@/components/math-answer-composer";
import { HintButton, HintPanel, useHints } from "@/components/hint-panel";
import { QuestionFeedback } from "@/components/question-feedback";
import { Banner } from "@/components/question-feedback";
import { answerSignature, submitLocked } from "@/lib/answer-signature";
import { RemediationPanel } from "@/components/remediation-panel";
import {
  attemptReducer,
  canSubmit,
  initialAttemptState,
} from "@/lib/question-attempt-machine";
import { toClientFormat } from "@/lib/question-client";
import type { AnswerPayload } from "@/lib/question-marking";
import type { Question } from "@/lib/supabase/questions";

const MASTERY_THRESHOLD = 4;

const photoAllowed = (t: string) => t !== "multiple-choice" && t !== "matching";

const inputClass =
  "rounded-2xl border border-border bg-surface p-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

type QueueEntry = { idx: number; isRetry: boolean };

export function BankPracticePlayer({
  bank,
  topicId,
}: {
  bank: Question[];
  topicId: string;
}) {
  const [queue, setQueue] = useState<QueueEntry[]>(() =>
    bank.map((_, i) => ({ idx: i, isRetry: false }))
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [firstAttemptCorrect, setFirstAttemptCorrect] = useState(0);
  const [phase, setPhase] = useState<"loading" | "active" | "feedback" | "mastery" | "done">(
    "loading"
  );
  // Key resets the form on each new question
  const [questionKey, setQuestionKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    createBankSessionAction(topicId)
      .then((id) => {
        if (cancelled) return;
        setSessionId(id);
        setPhase("active");
      })
      .catch(() => {
        // Practice still works without a tracked session; don't strand the student on the spinner.
        if (!cancelled) setPhase("active");
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const current = queue[0];
  const currentQuestion = current !== undefined ? bank[current.idx] : null;

  const handleAnswered = useCallback(
    (correct: boolean, assisted = false) => {
      if (!current) return;
      setPhase("feedback");

      const newFAC = !current.isRetry && !assisted && correct ? firstAttemptCorrect + 1 : firstAttemptCorrect;
      if (newFAC >= MASTERY_THRESHOLD) {
        setFirstAttemptCorrect(newFAC);
        if (sessionId) completeBankSessionAction(sessionId, true).catch(() => {});
        setPhase("mastery");
        return;
      }
      if (!current.isRetry && !assisted && correct) {
        setFirstAttemptCorrect(newFAC);
      }
    },
    [current, firstAttemptCorrect, sessionId]
  );

  function advanceQueue(correct: boolean) {
    const head = queue[0];
    if (!head) return;
    const rest = queue.slice(1);
    const finished = correct && rest.length === 0;
    if (finished && sessionId) completeBankSessionAction(sessionId, false).catch(() => {});
    setQueue(correct ? rest : [...rest, { idx: head.idx, isRetry: true }]);
    setQuestionKey((k) => k + 1);
    setPhase(finished ? "done" : "active");
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" strokeWidth={2} /> Starting practice session…
      </div>
    );
  }

  if (phase === "mastery") {
    return (
      <MasteryScreen
        firstAttemptCorrect={firstAttemptCorrect}
        total={bank.length}
      />
    );
  }

  if (phase === "done" || !currentQuestion) {
    return (
      <DoneScreen
        firstAttemptCorrect={firstAttemptCorrect}
        total={bank.length}
      />
    );
  }

  const remaining = queue.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Mastery: one pip per first-try correct answer needed. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <div
            role="meter"
            aria-label="Questions correct first time"
            aria-valuemin={0}
            aria-valuemax={MASTERY_THRESHOLD}
            aria-valuenow={firstAttemptCorrect}
            className="flex items-center gap-1.5"
          >
            {Array.from({ length: MASTERY_THRESHOLD }).map((_, i) => (
              <span
                key={i}
                className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  i < firstAttemptCorrect ? "border-success bg-success text-white" : "border-border text-transparent"
                }`}
              >
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
            ))}
          </div>
          <p className="text-sm text-muted">
            {firstAttemptCorrect} of {MASTERY_THRESHOLD} right first time to master this topic
          </p>
        </div>
        <p className="font-[family-name:var(--font-mono)] text-sm text-muted">{remaining} left in this round</p>
      </div>

      {/* Question image */}
      {currentQuestion.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentQuestion.image_url}
          alt="Question illustration"
          className="max-h-64 w-full rounded-2xl border border-border object-contain"
        />
      )}

      <QuestionForm
        key={questionKey}
        question={currentQuestion}
        topicId={topicId}
        sessionId={sessionId}
        isRetry={current.isRetry}
        onAnswered={(correct, assisted) => {
          handleAnswered(correct, assisted);
          return correct;
        }}
        onNext={(correct) => advanceQueue(correct)}
      />
    </div>
  );
}

// ── Inner form component (remounted on each new question) ──────────────────

function QuestionForm({
  question,
  topicId,
  sessionId,
  isRetry,
  onAnswered,
  onNext,
}: {
  question: Question;
  topicId: string;
  sessionId: string | null;
  isRetry: boolean;
  onAnswered: (correct: boolean, assisted?: boolean) => boolean;
  onNext: (correct: boolean) => void;
}) {
  const format = toClientFormat(question.format);
  const [state, action, pending] = useActionState<PracticeState, FormData>(
    submitBankAnswerAction,
    undefined
  );

  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [workingSteps, setWorkingSteps] = useState<string[]>(["", "", ""]);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [parts, setParts] = useState<Record<number, string>>({});
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [helpDone, setHelpDone] = useState(false);
  // Escalating attempt flow (numeric + written answers). MCQ and matching keep
  // the old single-shot result and requeue.
  const escalates = format.type !== "multiple-choice" && format.type !== "matching";
  const isNumeric = format.type === "numeric" || format.type === "calculation";
  const [attempt, dispatch] = useReducer(attemptReducer, undefined, initialAttemptState);
  // The result object the student dismissed with "Try again"; a new result is never dismissed.
  const [dismissedResult, setDismissedResult] = useState<unknown>(null);
  const [helpOpen, setHelpOpen] = useState(false); // remediation panel shown
  const [helpSource, setHelpSource] = useState<"hint" | "escalation">("hint");
  const hintState = useHints(question.id, {
    scaffold: isNumeric,
    onScaffold: () => {
      setHelpSource("hint");
      setHelpOpen(true);
    },
  });

  const result = state && "feedback" in state ? state : null;
  const lastCorrect: boolean | null = helpDone
    ? true
    : result
      ? (result.correct ?? result.marksAwarded === result.maxMarks)
      : null;
  const inputString = [text, ...Object.values(parts)].join(" ").trim();
  // Submit stays off with no real answer (spaces don't count) and, after
  // feedback, until the answer actually changes.
  const currentAnswer = { selected, text, workingSteps, matches, parts, imagePaths };
  const [lastSubmittedSig, setLastSubmittedSig] = useState<string | null>(null);
  const answerLocked = submitLocked(currentAnswer, lastSubmittedSig);
  const resubmitBlocked =
    escalates && attempt.lastWrongInput !== null && !imagePaths.length && !canSubmit(attempt.lastWrongInput, inputString);

  useEffect(() => {
    if (!result) return;
    const correct = result.correct ?? result.marksAwarded === result.maxMarks;
    if (!escalates) {
      if (correct) celebrate();
      onAnswered(correct);
      return;
    }
    if (correct) {
      celebrate();
      dispatch({ type: "submitRight" });
      onAnswered(true, attempt.attempts > 0 || helpOpen);
    } else if (attempt.phase === "second-chance") {
      dispatch({ type: "startRemediation", scaffold: isNumeric });
    } else {
      dispatch({ type: "submitWrong", input: inputString });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  function openEscalation() {
    dispatch({ type: "startRemediation", scaffold: isNumeric });
    setHelpSource("escalation");
    setHelpOpen(true);
  }

  function helpComplete() {
    setHelpDone(true);
    if (attempt.phase === "remediation") dispatch({ type: "remediationPassed" });
    else dispatch({ type: "submitRight" });
    celebrate();
    onAnswered(true, true);
  }

  const complete = attempt.phase === "complete";
  const escalated = escalates && !complete && attempt.attempts > 0;
  const dismissed = dismissedResult === result;
  const showEscalatedFeedback = escalated && !!result && !dismissed && !helpOpen;
  const showFormSubmit = escalates ? !complete && !helpOpen && !(showEscalatedFeedback && attempt.phase === "remediation") : !result;
  const oldResult = escalates ? (complete && result && !helpOpen ? result : null) : result;

  useEffect(() => {
    if (!uploadId || imagePaths.length > 0) return;
    const id = setInterval(async () => {
      const status = await getPracticeUploadStatusAction(uploadId);
      if (status?.status === "ready") {
        setImagePaths(status.imagePaths);
        setImageUrls(status.imageUrls);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [uploadId, imagePaths.length]);

  async function attachPhoto() {
    const res = await createPracticeUploadSessionAction({
      topicId,
      questionId: question.id,
    });
    setUploadId(res.uploadId);
    setQrDataUrl(res.qrDataUrl);
  }

  async function uploadFromThisDevice(files: FileList | null) {
    if (!uploadId || !files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("uploadId", uploadId);
    Array.from(files).forEach((f) => fd.append("files", f));
    const res = await uploadPracticeImagesAction(undefined, fd);
    if (res?.success) {
      const status = await getPracticeUploadStatusAction(uploadId);
      if (status) {
        setImagePaths(status.imagePaths);
        setImageUrls(status.imageUrls);
      }
    }
    setUploading(false);
  }

  const payload: AnswerPayload = {
    selected: selected.length ? selected : undefined,
    text: text || undefined,
    workingSteps: workingSteps.some((s) => s.trim().length > 0) ? workingSteps : undefined,
    matches:
      format.type === "matching"
        ? format.lefts.map((_, i) =>
            matches[i] !== undefined ? format.rights[matches[i]].index : -1
          )
        : undefined,
    parts:
      format.type === "structured" ? format.parts.map((_, i) => parts[i] ?? "") : undefined,
    imagePaths: imagePaths.length ? imagePaths : undefined,
  };

  function toggleOption(idx: number, multi: boolean) {
    setSelected((prev) =>
      multi ? (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]) : [idx]
    );
  }

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
      <form
        action={action}
        onSubmit={() => setLastSubmittedSig(answerSignature(currentAnswer))}
        className="flex min-w-0 flex-col gap-6"
      >
        <input type="hidden" name="topicId" value={topicId} />
        <input type="hidden" name="questionId" value={question.id} />
        <input type="hidden" name="answerPayload" value={JSON.stringify(payload)} />
        {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
        <input type="hidden" name="isRetry" value={String(isRetry)} />
        <input type="hidden" name="hintsShown" value={hintState.hints.length} />

        {question.prompt && (
          <div className="flex flex-col gap-2">
            <p className="font-[family-name:var(--font-display)] text-2xl leading-snug text-foreground lg:text-3xl">
              <RichText text={question.prompt} />
            </p>
            <p className="font-[family-name:var(--font-mono)] text-sm text-highlight-ink">
              {question.max_marks} {question.max_marks === 1 ? "mark" : "marks"}
              {escalates && attempt.attempts > 0 && (
                <span className="ml-3 inline-flex items-center gap-1 align-middle">
                  {complete ? (
                    <Check className="size-4 text-success-ink" strokeWidth={3} aria-label="Question complete" />
                  ) : (
                    <X className="size-4 text-error-ink" strokeWidth={3} aria-label="Not yet correct" />
                  )}
                </span>
              )}
            </p>
          </div>
        )}

        {showFormSubmit && <HintPanel state={hintState} />}

        {format.type === "data-analysis" && (
          <div className="lesson-embed overflow-x-auto">
            <table>
              <thead>
                <tr>
                  {format.table.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {format.table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {format.type === "multiple-choice" && (
          <div className="flex flex-col gap-2">
            {format.multi && <p className="text-sm text-muted">Select all that apply.</p>}
            {format.options.map((option, idx) => (
              <button
                key={idx}
                type="button"
                aria-pressed={selected.includes(idx)}
                disabled={!!result}
                onClick={() => toggleOption(idx, format.multi)}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left text-base transition-colors ${
                  selected.includes(idx)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface text-foreground hover:border-primary/50"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                    selected.includes(idx) ? "border-primary bg-primary text-white" : "border-border text-muted"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1"><RichText text={option} /></span>
              </button>
            ))}
          </div>
        )}

        {format.type === "matching" && (
          <MatchingBoard
            lefts={format.lefts}
            rights={format.rights}
            value={matches}
            onChange={setMatches}
            revealed={!!result}
            correctRightIndex={(leftIndex) => format.rights.findIndex((r) => r.index === leftIndex)}
          />
        )}

        {format.type === "short-answer" && (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your answer..."
            className={inputClass}
          />
        )}

        {format.type === "numeric" && (
          <NumericAnswer value={text} onChange={setText} unit={format.unit} />
        )}

        {format.type === "calculation" && (
          <MathAnswerComposer
            answer={text}
            onAnswerChange={setText}
            answerFormat={format.answerFormat}
            unit={format.unit}
            showWorkingSteps={
              question.max_marks >= 4 || format.answerFormat === "expression"
            }
            workingSteps={workingSteps}
            onWorkingStepsChange={setWorkingSteps}
          />
        )}

        {format.type === "structured" &&
          format.parts.map((part, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-sm text-foreground">
                <span className="font-semibold">({part.label})</span>{" "}
                <RichText text={part.prompt} />{" "}
                <span className="font-mono text-xs text-highlight-ink">
                  [{part.marks} {part.marks === 1 ? "mark" : "marks"}]
                </span>
              </p>
              <AnswerEditor
                label={`Answer for part (${part.label})`}
                minRows={3}
                onChange={(v) => setParts((p) => ({ ...p, [i]: v }))}
              />
            </div>
          ))}

        {(format.type === "extended" ||
          format.type === "practical" ||
          format.type === "data-analysis") && (
          <AnswerEditor
            onChange={setText}
            minRows={format.type === "extended" ? 10 : 7}
            placeholder={
              format.type === "practical"
                ? "Describe your method, variables, steps, risks..."
                : "Write your answer..."
            }
          />
        )}

        {/* Photo upload (written answers only) */}
        {photoAllowed(format.type) && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
          {!uploadId ? (
            <button
              type="button"
              onClick={attachPhoto}
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary-ink hover:underline"
            >
              <Camera className="size-4" strokeWidth={2} /> Attach a photo of your handwritten answer instead
            </button>
          ) : imagePaths.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-sm text-success-ink">
                <Check className="size-4 shrink-0" strokeWidth={2.5} />
                {imagePaths.length} photo{imagePaths.length === 1 ? "" : "s"} attached
              </p>
              <div className="flex gap-2 overflow-x-auto">
                {imageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`Uploaded answer page ${i + 1}`}
                    className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <label className="flex-1 text-sm text-foreground">
                <span className="mb-1 block text-sm text-muted">Upload from this device</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  disabled={uploading}
                  onChange={(e) => uploadFromThisDevice(e.target.files)}
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                />
                {uploading && <span className="mt-1 block text-sm text-muted">Uploading…</span>}
              </label>
              {qrDataUrl && (
                <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR code to upload from your phone"
                    className="h-28 w-28 rounded-lg border border-border bg-white p-1"
                  />
                  <p className="text-center text-sm text-muted">Or scan with your phone</p>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {state && "message" in state && (
          <p className="text-sm text-error-ink">{state.message}</p>
        )}

        {pending && <StatusLine text="Marking your answer…" />}
        {showFormSubmit && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="min-h-11" disabled={pending || resubmitBlocked || answerLocked}
              title={answerLocked && !pending ? "Change your answer to submit again" : undefined}>
              {pending ? "Marking..." : "Submit answer"}
            </Button>
            <HintButton state={hintState} disabled={pending} />
          </div>
        )}
      </form>

      {!result && !helpOpen && (
        <aside className="hidden flex-col gap-3 border-t border-border pt-4 lg:sticky lg:top-24 lg:flex">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">How this works</h3>
          <p className="max-w-[40ch] text-sm text-muted">
            Answer in your own words. Each answer is marked against the exam board&apos;s mark scheme and you see
            exactly which points you earned.
          </p>
          <p className="max-w-[40ch] text-sm text-muted">
            Questions you miss come back at the end of the round. Get four right first time to master the topic.
          </p>
        </aside>
      )}

      {(showEscalatedFeedback || helpOpen) && (
        <div className="flex min-w-0 flex-col gap-4 border-t border-border pt-4 lg:sticky lg:top-24">
          {showEscalatedFeedback && result && (
            <QuestionFeedback
              phase={attempt.phase}
              kind={isNumeric ? "numeric" : "free-text"}
              marksAwarded={result.marksAwarded}
              maxMarks={result.maxMarks}
              points={result.feedback.map((f) => ({ point: f.point, comment: f.comment, met: f.met }))}
              improveHint={result.feedback.find((f) => !f.met)?.comment}
              modelAnswer={result.modelAnswer}
              attempt={attempt.attempts >= 2 ? 2 : 1}
              canSkip={attempt.phase === "second-chance"}
              onTryAgain={() => {
                dispatch({ type: "tryAgain" });
                setDismissedResult(result);
              }}
              onSkip={() => dispatch({ type: "skip" })}
              onLearn={openEscalation}
            />
          )}
          {helpOpen && (
            <RemediationPanel
              questionId={question.id}
              source={helpSource}
              onComplete={helpComplete}
              onClose={() => (helpSource === "hint" ? setHelpOpen(false) : onNext(false))}
            />
          )}
          {complete && (
            <>
              {helpOpen && <Banner tone="success">You worked it out</Banner>}
              <Button type="button" className="min-h-11 w-full" onClick={() => onNext(true)}>
                Next question →
              </Button>
            </>
          )}
        </div>
      )}

      {oldResult && (
        <div className="animate-fade-slide-up flex min-w-0 flex-col gap-4 border-t border-border pt-4 lg:sticky lg:top-24">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Feedback</h3>
            <span className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-highlight-ink">
              {oldResult.marksAwarded} / {oldResult.maxMarks}
            </span>
          </div>

          {isRetry && (
            <p className="rounded-lg bg-highlight/10 px-3 py-1.5 text-sm text-highlight-ink">
              Retry question
            </p>
          )}

          <div className="flex flex-col gap-2">
            {oldResult.feedback.map((point, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm ${
                  point.met
                    ? "border-success/40 bg-success/10"
                    : "border-error/40 bg-error/10"
                }`}
              >
                <p className={`flex items-center gap-1.5 ${point.met ? "text-success-ink" : "text-error-ink"}`}>
                  {point.met ? (
                    <Check className="size-3.5 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <X className="size-3.5 shrink-0" strokeWidth={2.5} />
                  )}
                  <RichText text={point.point} />
                </p>
                <p className="mt-1 text-sm text-muted">
                  <RichText text={point.comment} />
                </p>
              </div>
            ))}
          </div>

          {oldResult.marksAwarded < oldResult.maxMarks && (
            <ExplainBox fetchExplanation={() => explainPracticeAnswerAction(question.id)} />
          )}

          {oldResult.modelAnswer && (
            <details className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <summary className="cursor-pointer text-sm font-medium text-primary-ink">
                Show model answer
              </summary>
              <p className="mt-2 text-sm text-foreground">
                <RichText text={oldResult.modelAnswer} />
              </p>
            </details>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={() => onNext(lastCorrect ?? false)}
          >
            {lastCorrect ? "Next question →" : "Retry later, next question →"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── End screens ────────────────────────────────────────────────────────────

function MasteryScreen({
  firstAttemptCorrect,
  total,
}: {
  firstAttemptCorrect: number;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Trophy className="size-12 text-highlight-ink" strokeWidth={1.5} />
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
        Mastery achieved!
      </h2>
      <p className="text-sm text-muted">
        You got {firstAttemptCorrect} out of {total} questions correct on the first attempt.
      </p>
      <a
        href=".."
        className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
      >
        Back to topic
      </a>
    </div>
  );
}

function DoneScreen({
  firstAttemptCorrect,
  total,
}: {
  firstAttemptCorrect: number;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <CheckCircle2 className="size-12 text-success-ink" strokeWidth={1.5} />
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
        Practice complete
      </h2>
      <p className="text-sm text-muted">
        {firstAttemptCorrect} / {total} correct on first attempt.
      </p>
      <a
        href=".."
        className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
      >
        Back to topic
      </a>
    </div>
  );
}
