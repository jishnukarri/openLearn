"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { reportContentAction, type ReportState } from "@/app/actions/reports";
import { requestExtraHelpAction } from "@/app/actions/lessons";

// A small "flag an issue" affordance for lesson/practice content, reports
// land in /admin/reports with enough context (topic/subtopic/question id)
// for an admin to find and fix the actual generated content.
//
// For lesson reports (topicId present, no questionId): after submitting,
// offers to regenerate the lesson immediately. If the student says it's still
// broken after regeneration, the report stays in the admin queue anyway.
export function ReportButton({
  contextLabel,
  topicId,
  subtopicId,
  questionId,
}: {
  contextLabel: string;
  topicId?: string;
  subtopicId?: string;
  questionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [state, action, pending] = useActionState<ReportState, FormData>(
    reportContentAction,
    undefined
  );

  // Whether to offer regen: topic-level lesson report only (no question or subtopic)
  const isLessonReport = !!topicId && !questionId && !subtopicId;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 self-start text-xs text-muted hover:text-error"
      >
        <Flag className="size-3.5" strokeWidth={2} /> Report an issue
      </button>
    );
  }

  if (state?.success && isLessonReport && !dismissed) {
    if (escalated) {
      return (
        <p className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
          Got it, our team has been notified and will review this lesson.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
        <p className="text-xs font-medium text-foreground">
          Issue logged. We can regenerate this lesson right now to fix it, want us to try?
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={requestExtraHelpAction}>
            <input type="hidden" name="topicId" value={topicId} />
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
            >
              Regenerate lesson
            </button>
          </form>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            No thanks
          </button>
        </div>
        <button
          type="button"
          onClick={() => setEscalated(true)}
          className="self-start text-3xs text-muted underline underline-offset-2 hover:text-error"
        >
          Already regenerated and still broken? Escalate →
        </button>
      </div>
    );
  }

  if (state?.success) {
    return (
      <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
        Thanks, an admin will take a look.
      </p>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
    >
      <input type="hidden" name="contextLabel" value={contextLabel} />
      {topicId && <input type="hidden" name="topicId" value={topicId} />}
      {subtopicId && <input type="hidden" name="subtopicId" value={subtopicId} />}
      {questionId && <input type="hidden" name="questionId" value={questionId} />}
      <label className="text-xs font-medium text-foreground">
        What&apos;s wrong with this?
      </label>
      <textarea
        name="message"
        rows={2}
        placeholder="e.g. This answer looks incorrect, or the diagram doesn't match the text..."
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      {state?.message && <p className="text-xs text-error">{state.message}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
