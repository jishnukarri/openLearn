"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { askLessonTutorAction } from "@/app/actions/lessons";

const SUGGESTIONS = [
  "Explain this more simply",
  "Give me a hint",
  "Check my understanding",
];

export function LessonTutor({
  topicId,
  context,
}: {
  topicId: string;
  context: string;
}) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Mobile-only: the panel collapses into a floating bubble, like a
  // customer-support chat widget. Desktop ignores this, the sidebar stays
  // permanently open via the `lg:block` override below.
  const [open, setOpen] = useState(false);
  const [hasUnseenReply, setHasUnseenReply] = useState(false);

  function ask(prompt = question) {
    const trimmed = prompt.trim();
    if (!trimmed || isPending) return;

    setQuestion("");
    setError(null);
    startTransition(async () => {
      try {
        setReply(await askLessonTutorAction({ topicId, context, question: trimmed }));
        if (!open) setHasUnseenReply(true);
      } catch {
        setError("I couldn't reach your study coach. Please try again.");
      }
    });
  }

  return (
    <div>
      {/* Mobile-only floating bubble, the panel itself stays permanently open on desktop (lg:block below overrides `open`). */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setHasUnseenReply(false);
        }}
        aria-label="Open your AI study coach"
        className={`fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-2xl text-white shadow-[0_8px_24px_-6px_var(--primary)] transition-transform hover:scale-105 active:scale-95 lg:hidden ${
          open ? "hidden" : "flex"
        }`}
      >
        ✦
        {hasUnseenReply && (
          <span className="absolute right-0 top-0 size-3.5 animate-pop-in rounded-full border-2 border-background bg-error" />
        )}
      </button>

      {/* Backdrop, mobile only, dismisses the panel on tap-outside. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-x-4 bottom-5 z-50 max-h-[80dvh] overflow-y-auto rounded-2xl border border-primary/30 bg-surface p-4 shadow-2xl ${
          open ? "animate-pop-in block" : "hidden"
        } lg:sticky lg:top-6 lg:z-auto lg:block lg:inset-auto lg:max-h-none lg:shadow-none`}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-sm">✦</span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Your AI study coach</h2>
            <p className="text-xs text-muted">Here for this step of the lesson</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close study coach"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground lg:hidden"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={isPending}
            onClick={() => ask(suggestion)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {(isPending || reply || error) && (
        <div className="mt-4 rounded-xl bg-background p-3 text-sm leading-6">
          {isPending && <p className="text-muted">Thinking through this with you…</p>}
          {!isPending && reply && <p className="text-foreground">{reply}</p>}
          {!isPending && error && <p className="text-error">{error}</p>}
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <label className="sr-only" htmlFor="lesson-tutor-question">Ask your study coach</label>
        <input
          id="lesson-tutor-question"
          value={question}
          maxLength={500}
          disabled={isPending}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this step…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!question.trim() || isPending}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      </aside>
    </div>
  );
}
