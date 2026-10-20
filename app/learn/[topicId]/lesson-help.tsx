"use client";

import { useState, useTransition } from "react";
import { Lightbulb, MessageCircleQuestion, NotebookPen } from "lucide-react";
import { askLessonTutorAction } from "@/app/actions/lessons";
import { StatusLine } from "@/components/pending-status";

const CHOICES = [
  { id: "simple", label: "Explain it simply", Icon: MessageCircleQuestion, message: "Explain this step more simply, in a few short sentences for a 13 year old." },
  { id: "example", label: "Show me an example", Icon: NotebookPen, message: "Give me one short, everyday example of this step." },
  { id: "hint", label: "Give me a hint", Icon: Lightbulb, message: "Give me a hint for this step without giving away the answer." },
] as const;

type ChoiceId = (typeof CHOICES)[number]["id"];

// Inline "Stuck?" panel: three plain choices, answered by the existing lesson
// tutor action. Replies are kept so reopening never re-asks.
export function StuckHelp({ topicId, context }: { topicId: string; context: string }) {
  const [replies, setReplies] = useState<Partial<Record<ChoiceId, string>>>({});
  const [active, setActive] = useState<ChoiceId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(id: ChoiceId, message: string) {
    setActive(id);
    setError(null);
    if (replies[id] || isPending) return;
    startTransition(async () => {
      try {
        const turn = await askLessonTutorAction({ topicId, context, question: message, history: [] });
        setReplies((r) => ({ ...r, [id]: turn.reply }));
      } catch {
        setError("I couldn't reach your study coach. Try again in a moment.");
      }
    });
  }

  return (
    <section aria-label="Help" className="animate-fade-slide-up border-b border-border bg-surface/60 px-4 py-4 sm:px-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">What would help?</h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {CHOICES.map(({ id, label, Icon, message }) => (
          <button
            key={id}
            type="button"
            disabled={isPending}
            aria-pressed={active === id}
            onClick={() => choose(id, message)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 motion-reduce:transition-none ${
              active === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary"
            }`}
          >
            <Icon className="size-4" strokeWidth={2} /> {label}
          </button>
        ))}
      </div>
      <div className="mt-3 text-sm leading-relaxed" aria-live="polite">
        {isPending && <StatusLine text="Your coach is thinking…" />}
        {!isPending && active && replies[active] && (
          <p className="max-w-[65ch] rounded-xl bg-background px-3 py-2 text-foreground">{replies[active]}</p>
        )}
        {error && <p className="text-error">{error}</p>}
        {!active && <p className="text-muted">Pick one and your study coach will help with this step.</p>}
      </div>
    </section>
  );
}
