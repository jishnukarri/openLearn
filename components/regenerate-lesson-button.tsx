"use client";

import { useRef } from "react";
import { Button } from "@/components/button";
import { SubmitButton } from "@/components/submit-button";
import { PendingAiOverlay } from "@/components/pending-ai-overlay";

// Opens a confirmation dialog before running a slow "replace the lesson"
// server action. Pass the hidden field the action needs (topicId or
// subtopicId).
export function RegenerateLessonButton({
  action,
  fieldName,
  fieldValue,
  label = "Regenerate lesson",
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  fieldName: "topicId" | "subtopicId";
  fieldValue: string;
  label?: string;
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="shrink-0 text-sm text-primary hover:underline"
        >
          {label}
        </button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="compact"
          className="!shadow-none"
          onClick={() => dialogRef.current?.showModal()}
        >
          {label}
        </Button>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby={`regen-title-${fieldValue}`}
        className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-surface p-6 text-foreground backdrop:bg-black/40"
      >
        <form
          action={async (formData) => {
            await action(formData);
            dialogRef.current?.close();
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name={fieldName} value={fieldValue} />
          <h3 id={`regen-title-${fieldValue}`} className="text-lg font-semibold">
            Regenerate this lesson?
          </h3>
          <p className="text-base text-muted">
            This replaces the current lesson, including any edits made by hand. Students&apos; progress is kept.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              size="compact"
              className="!shadow-none"
              autoFocus
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
            <SubmitButton size="compact" className="!shadow-none" pendingText="Replacing…">
              Replace lesson
            </SubmitButton>
          </div>
          <PendingAiOverlay
            title="Regenerating the lesson"
            messages={["Reading your instructions…", "Writing the lesson…", "Building the animated scenes…", "Nearly there…"]}
          />
        </form>
      </dialog>
    </>
  );
}
