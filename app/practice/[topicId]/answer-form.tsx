"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, X, Camera } from "lucide-react";
import {
  submitAnswerAction,
  newSimilarQuestionAction,
  newSimilarSubtopicQuestionAction,
  explainPracticeAnswerAction,
  type PracticeState,
} from "@/app/actions/practice";
import { celebrate } from "@/lib/confetti";
import { Button } from "@/components/button";
import { StatusLine, PendingStatus } from "@/components/pending-status";
import { RichText } from "@/components/rich-text";
import { MatchingBoard } from "@/components/matching-board";
import { ExplainBox } from "@/components/explain-box";
import { AnswerEditor } from "@/components/answer-editor";
import { NumericAnswer } from "@/components/numeric-answer";
import { MathAnswerComposer } from "@/components/math-answer-composer";
import {
  createPracticeUploadSessionAction,
  getPracticeUploadStatusAction,
  uploadPracticeImagesAction,
} from "@/app/actions/practice-uploads";
import { HintButton, HintPanel, useHints } from "@/components/hint-panel";
import { RemediationPanel } from "@/components/remediation-panel";
import type { ClientFormat } from "@/lib/question-client";
import type { AnswerPayload } from "@/lib/question-marking";

const inputClass =
  "rounded-2xl border border-border bg-surface p-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function AnswerForm({
  topicId,
  questionId,
  format,
  maxMarks,
  mode = "topic",
  refTopicId,
}: {
  topicId: string;
  questionId: string;
  format: ClientFormat;
  maxMarks: number;
  // Subtopic practice reuses this component under /practice/subtopic/[id]
  //, `topicId` there is actually the subtopic id (used for routing/links),
  // while `refTopicId` is the real parent topic id, needed anywhere a
  // foreign key or getTopic() lookup requires an actual topics row (photo
  // upload sessions).
  mode?: "topic" | "subtopic";
  refTopicId?: string;
}) {
  const [state, action, pending] = useActionState<PracticeState, FormData>(
    submitAnswerAction,
    undefined
  );

  // Answer state across formats, only the relevant pieces are used.
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [workingSteps, setWorkingSteps] = useState<string[]>(["", "", ""]);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [parts, setParts] = useState<Record<number, string>>({});

  // Photo/PDF hand-off, same-device upload and the QR-to-phone path both
  // write into the same upload session, polled here until ready.
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false);
  const [helpDone, setHelpDone] = useState(false);
  const hintState = useHints(questionId, {
    scaffold: format.type === "numeric" || format.type === "calculation",
    onScaffold: () => setHelpOpen(true),
  });
  const result = state && "feedback" in state ? state : null;

  useEffect(() => {
    if (result && result.marksAwarded === result.maxMarks) celebrate();
  }, [result]);

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
      topicId: refTopicId ?? topicId,
      questionId,
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
    const result = await uploadPracticeImagesAction(undefined, fd);
    if (result?.success) {
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
    workingSteps: workingSteps.some((step) => step.trim().length > 0)
      ? workingSteps
      : undefined,
    matches:
      format.type === "matching"
        ? format.lefts.map((_, i) =>
            matches[i] !== undefined ? format.rights[matches[i]].index : -1
          )
        : undefined,
    parts:
      format.type === "structured"
        ? format.parts.map((_, i) => parts[i] ?? "")
        : undefined,
    imagePaths: imagePaths.length ? imagePaths : undefined,
  };

  function toggleOption(idx: number, multi: boolean) {
    setSelected((prev) =>
      multi
        ? prev.includes(idx)
          ? prev.filter((i) => i !== idx)
          : [...prev, idx]
        : [idx]
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <form action={action} className="flex flex-1 flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <input type="hidden" name="topicId" value={topicId} />
        <input type="hidden" name="questionId" value={questionId} />
        <input
          type="hidden"
          name="answerPayload"
          value={JSON.stringify(payload)}
        />
        <input type="hidden" name="hintsShown" value={hintState.hints.length} />

        {!result && <HintPanel state={hintState} />}

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
            {format.multi && (
              <p className="text-xs text-muted">Select all that apply.</p>
            )}
            {format.options.map((option, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleOption(idx, format.multi)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected.includes(idx)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface text-foreground hover:border-primary/50"
                }`}
              >
                <RichText text={option} />
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
            revealed={false}
          />
        )}

        {format.type === "short-answer" && (
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your answer..."
              className={`${inputClass} flex-1`}
            />
          </div>
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
            showWorkingSteps={maxMarks >= 4 || format.answerFormat === "expression"}
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
                <span className="font-mono text-xs text-highlight">
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

        {format.type !== "multiple-choice" && format.type !== "matching" && (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
            {!uploadId ? (
              <button
                type="button"
                onClick={attachPhoto}
                className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
              >
                <Camera className="size-4" strokeWidth={2} /> Attach a photo of your handwritten answer instead
              </button>
            ) : imagePaths.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <Check className="size-4 shrink-0" strokeWidth={2.5} />
                  {imagePaths.length} photo{imagePaths.length === 1 ? "" : "s"} attached, this
                  will be marked instead of anything typed above.
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {imageUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, unknown dimensions
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
                  <span className="mb-1 block text-xs text-muted">
                    Upload from this device
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    disabled={uploading}
                    onChange={(e) => uploadFromThisDevice(e.target.files)}
                    className="w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                  />
                  {uploading && <span className="mt-1 block text-xs text-muted">Uploading…</span>}
                </label>
                {qrDataUrl && (
                  // Hidden below sm, scanning a QR code on the same phone
                  // you're already using doesn't make sense; only worth
                  // showing once there's room for it to plausibly be a
                  // second device (tablet/desktop).
                  <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URL, not an optimizable remote image */}
                    <img
                      src={qrDataUrl}
                      alt="QR code to upload from your phone"
                      className="h-28 w-28 rounded-lg border border-border bg-white p-1"
                    />
                    <p className="text-center text-xs text-muted">
                      Or scan with your phone
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {state && "message" in state && (
          <p className="text-sm text-error">{state.message}</p>
        )}
        {pending && <StatusLine text="Marking your answer…" />}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Marking..." : "Submit answer"}
          </Button>
          {!result && <HintButton state={hintState} disabled={pending} />}
        </div>
      </form>

      {helpOpen && !result && (
        <div className="flex flex-1 flex-col gap-3 lg:sticky lg:top-6">
          <RemediationPanel questionId={questionId} source="hint" onComplete={() => setHelpDone(true)} />
          {helpDone && (
            <form action={mode === "subtopic" ? newSimilarSubtopicQuestionAction : newSimilarQuestionAction}>
              <input type="hidden" name={mode === "subtopic" ? "subtopicId" : "topicId"} value={topicId} />
              <Button type="submit" className="min-h-11">Try a similar question</Button>
            </form>
          )}
        </div>
      )}

      {result && (
        <div className="animate-pop-in flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Feedback</p>
            <span className="animate-pop-in inline-block font-[family-name:var(--font-mono)] text-lg text-highlight">
              {result.marksAwarded} / {result.maxMarks}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {result.feedback.map((point, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm ${
                  point.met
                    ? "border-success/40 bg-success/10"
                    : "border-error/40 bg-error/10"
                }`}
              >
                <p
                  className={`${point.met ? "text-success" : "text-error"} ${
                    point.met ? "animate-settle" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {point.met ? (
                      <Check className="size-3.5 shrink-0" strokeWidth={2.5} />
                    ) : (
                      <X className="size-3.5 shrink-0" strokeWidth={2.5} />
                    )}
                    <RichText text={point.point} />
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  <RichText text={point.comment} />
                </p>
              </div>
            ))}
          </div>

          {result.marksAwarded < result.maxMarks && (
            <ExplainBox fetchExplanation={() => explainPracticeAnswerAction(questionId)} />
          )}

          {result.modelAnswer && (
            <details className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Show model answer
              </summary>
              <p className="mt-2 text-sm text-foreground">
                <RichText text={result.modelAnswer} />
              </p>
            </details>
          )}

          <form action={mode === "subtopic" ? newSimilarSubtopicQuestionAction : newSimilarQuestionAction}>
            <input
              type="hidden"
              name={mode === "subtopic" ? "subtopicId" : "topicId"}
              value={topicId}
            />
            <Button
              type="submit"
              variant="secondary"
              size="compact"
              className="!shadow-none"
            >
              Try a similar question
            </Button>
            <PendingStatus text="Thinking of a question…" />
          </form>
        </div>
      )}
    </div>
  );
}
