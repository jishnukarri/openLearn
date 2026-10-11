"use client";

import { useState, useTransition } from "react";
import { X, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
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
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [pendingQ, setPendingQ] = useState<string | null>(null);
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
    setPendingQ(trimmed);
    startTransition(async () => {
      try {
        const answer = await askLessonTutorAction({ topicId, context, question: trimmed });
        setThread((t) => [...t, { q: trimmed, a: answer }]);
        if (!open) setHasUnseenReply(true);
      } catch {
        setError("I couldn't reach your study coach. Please try again.");
      } finally {
        setPendingQ(null);
      }
    });
  }

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      {/* Mobile-only floating bubble, the panel itself stays permanently open on desktop (lg:block below overrides `open`). */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setHasUnseenReply(false);
        }}
        aria-label="Open your AI study coach"
        className={`fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_24px_-6px_var(--primary)] transition-transform hover:scale-105 active:scale-95 lg:hidden ${
          open ? "hidden" : "flex"
        }`}
      >
        <Sparkles className="size-6" strokeWidth={1.75} />
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
        className={`fixed inset-x-4 bottom-5 z-50 max-h-[80dvh] flex-col rounded-2xl border border-primary/30 bg-surface p-4 shadow-2xl ${
          open ? "animate-fade-slide-up flex" : "hidden"
        } lg:static lg:z-auto lg:flex lg:h-full lg:max-h-none lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
      >
        <div className="flex items-center gap-2">
          <BrandMark size={28} />
          <div className="flex-1">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Your AI study coach</h2>
            <p className="text-sm text-muted">Here for this step of the lesson</p>
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
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm leading-6" aria-live="polite">
        {thread.length === 0 && !pendingQ && (
          <p className="text-muted">Stuck on this step? Tap a suggestion or ask your own question.</p>
        )}
        {thread.map((m, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="self-end rounded-2xl rounded-br-md bg-primary/15 px-3 py-2 text-foreground">{m.q}</p>
            <p className="rounded-2xl rounded-bl-md bg-background px-3 py-2 text-foreground">{m.a}</p>
          </div>
        ))}
        {pendingQ && (
          <div className="flex flex-col gap-2">
            <p className="self-end rounded-2xl rounded-br-md bg-primary/15 px-3 py-2 text-foreground">{pendingQ}</p>
            <p className="rounded-2xl rounded-bl-md bg-background px-3 py-2 text-muted">Thinking through this with you…</p>
          </div>
        )}
        {error && <p className="text-error">{error}</p>}
      </div>

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
