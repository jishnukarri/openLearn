"use client";

import { useFormStatus } from "react-dom";
import {
  requestExtraHelpAction,
  tweakLessonAction,
  tweakSubtopicLessonAction,
} from "@/app/actions/lessons";
import { AiLoading } from "@/components/ai-loading";

function PendingOverlay({ title }: { title: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <AiLoading
      overlay
      title={title}
      messages={[
        "Rereading the lesson…",
        "Rewriting the tricky bits…",
        "Refreshing the quick checks…",
        "Nearly there…",
      ]}
    />
  );
}

// "This is too hard, simplify it" button with a full-screen AI overlay
// while the regeneration server action runs.
export function SimplifyForm({ topicId }: { topicId: string }) {
  return (
    <form action={requestExtraHelpAction}>
      <input type="hidden" name="topicId" value={topicId} />
      <PendingOverlay title="Making it simpler" />
      <button
        type="submit"
        className="shrink-0 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-foreground"
      >
        Need help?
      </button>
    </form>
  );
}

// Admin/teacher tweak box with the same pending treatment.
export function TweakForm({ topicId }: { topicId: string }) {
  return (
    <form
      action={tweakLessonAction}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="topicId" value={topicId} />
      <PendingOverlay title="Tweaking the lesson" />
      <label className="text-xs font-medium text-muted">
        Ask AI to tweak this lesson
      </label>
      <div className="flex items-center gap-2">
        <input
          name="instruction"
          placeholder="e.g. Add a diagram description to section 2"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Tweak
        </button>
      </div>
    </form>
  );
}

export function SubtopicTweakForm({ subtopicId }: { subtopicId: string }) {
  return (
    <form
      action={tweakSubtopicLessonAction}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="subtopicId" value={subtopicId} />
      <PendingOverlay title="Tweaking the subtopic lesson" />
      <label className="text-xs font-medium text-muted">Ask AI to tweak this lesson</label>
      <div className="flex items-center gap-2">
        <input
          name="instruction"
          placeholder="e.g. Break the worked example into smaller steps"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Tweak
        </button>
      </div>
    </form>
  );
}
