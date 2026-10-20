"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/button";
import { PendingAiOverlay } from "@/components/pending-ai-overlay";
import { RegenerateLessonButton } from "@/components/regenerate-lesson-button";
import { EASE_OUT } from "@/components/motion";
import { saveTopicInstructionsAction, regenerateTopicLessonAction } from "@/app/actions/subjects";
import { regenerateFlashcardsAction } from "@/app/actions/flashcards";

const INPUT =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function TopicInstructionsForm({
  topicId,
  initial,
}: {
  topicId: string;
  initial: string;
}) {
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex max-w-[65ch] flex-col gap-2 border-t border-border pt-3">
      <form
        action={(formData) =>
          startTransition(async () => {
            await saveTopicInstructionsAction(formData);
            setSaved(true);
          })
        }
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="topicId" value={topicId} />
        <label htmlFor={`topic-instr-${topicId}`} className="text-sm font-medium text-foreground">
          Custom instructions for this topic
        </label>
        <p id={`topic-instr-help-${topicId}`} className="text-sm text-muted">
          Used for this topic&apos;s lessons, practice questions and flashcards. Saving does not change what
          already exists — use Regenerate below to apply.
        </p>
        <textarea
          id={`topic-instr-${topicId}`}
          name="instructions"
          rows={2}
          defaultValue={initial}
          aria-describedby={`topic-instr-help-${topicId}`}
          onChange={() => setSaved(false)}
          placeholder="e.g. Always include a diagram description. Avoid calculator-based examples."
          className={INPUT}
        />
        <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>

      <AnimatePresence initial={false}>
        {saved && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="flex flex-col gap-2 rounded-lg bg-primary/10 px-3 py-2"
          >
            <p className="text-base font-medium text-foreground">
              Instructions saved. Regenerate the lesson to apply them.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-3">
        <RegenerateLessonButton
          action={regenerateTopicLessonAction}
          fieldName="topicId"
          fieldValue={topicId}
        />
        <form action={regenerateFlashcardsAction}>
          <input type="hidden" name="topicId" value={topicId} />
          <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
            Regenerate flashcards
          </Button>
          <PendingAiOverlay
            title="Regenerating flashcards"
            messages={["Reading your instructions…", "Writing the cards…", "Nearly there…"]}
          />
        </form>
      </div>
    </div>
  );
}
