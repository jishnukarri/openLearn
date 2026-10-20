"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { StatusLine } from "@/components/pending-status";
import { BrandMark } from "@/components/brand-mark";
import { askLessonTutorAction } from "@/app/actions/lessons";
import type { CoachTurn } from "@/lib/ai/lesson-tutor";

const SUGGESTIONS = [
  { label: "Quiz me", message: "Quiz me with a multiple-choice question on this step." },
  { label: "Ask me a question", message: "Ask me a direct question on this step." },
  { label: "Explain simply", message: "Explain this step more simply." },
  { label: "Give me a hint", message: "Give me a hint for this step." },
];

type Msg =
  | { role: "student"; text: string }
  | { role: "coach"; turn: CoachTurn; picked?: number };

export function LessonTutor({
  topicId,
  context,
}: {
  topicId: string;
  context: string;
}) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<Msg[]>([]);
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ask(prompt = question) {
    const trimmed = prompt.trim();
    if (!trimmed || isPending) return;

    const history = thread.map((m) =>
      m.role === "student"
        ? { role: "student" as const, text: m.text }
        : {
            role: "coach" as const,
            text:
              m.turn.kind === "mcq"
                ? `${m.turn.reply} Options: ${m.turn.options.join(" | ")}${m.picked !== undefined ? ` (student chose: ${m.turn.options[m.picked]})` : ""}`
                : m.turn.reply,
          }
    );

    setQuestion("");
    setError(null);
    setPendingQ(trimmed);
    setThread((t) => [...t, { role: "student", text: trimmed }]);
    startTransition(async () => {
      try {
        const turn = await askLessonTutorAction({ topicId, context, question: trimmed, history });
        setThread((t) => [...t, { role: "coach", turn }]);
      } catch {
        setError("I couldn't reach your study coach. Please try again.");
      } finally {
        setPendingQ(null);
      }
    });
  }

  function pick(msgIndex: number, optionIdx: number) {
    setThread((t) =>
      t.map((m, i) => (i === msgIndex && m.role === "coach" && m.picked === undefined ? { ...m, picked: optionIdx } : m))
    );
  }

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      {/* Desktop sidebar only: on phones the header's "Stuck? Help" panel replaces the old floating bubble. */}
      <aside className="hidden h-full max-h-none flex-col lg:flex">
        <div className="flex items-center gap-2">
          <BrandMark size={28} />
          <div className="flex-1">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Your AI study coach</h2>
            <p className="text-sm text-muted">Here for this step of the lesson</p>
          </div>
        </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            disabled={isPending}
            onClick={() => ask(suggestion.message)}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            {suggestion.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm leading-6" aria-live="polite">
        {thread.length === 0 && !pendingQ && (
          <p className="text-muted">Stuck, or want to test yourself? Tap Quiz me, or ask your own question.</p>
        )}
        {thread.map((m, i) =>
          m.role === "student" ? (
            <p key={i} className="self-end rounded-2xl rounded-br-md bg-primary/15 px-3 py-2 text-foreground">{m.text}</p>
          ) : m.turn.kind === "mcq" ? (
            <div key={i} className="flex flex-col gap-2 rounded-2xl rounded-bl-md bg-background p-3">
              <p className="font-medium text-foreground">{m.turn.reply}</p>
              <div className="flex flex-col gap-1.5">
                {m.turn.options.map((o, oi) => {
                  const answered = m.picked !== undefined;
                  const right = oi === m.turn.correctIndex;
                  const chosen = m.picked === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={answered}
                      onClick={() => pick(i, oi)}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                        !answered
                          ? "border-border hover:border-primary"
                          : right
                            ? "border-success bg-success/10"
                            : chosen
                              ? "border-error bg-error/10"
                              : "border-border opacity-60"
                      }`}
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-xs">
                        {answered && right ? <Check className="size-3" strokeWidth={3} /> : String.fromCharCode(65 + oi)}
                      </span>
                      <span className="text-foreground">{o}</span>
                    </button>
                  );
                })}
              </div>
              {m.picked !== undefined && (
                <p className="text-muted">
                  <span className={m.picked === m.turn.correctIndex ? "font-semibold text-success" : "font-semibold text-error"}>
                    {m.picked === m.turn.correctIndex ? "Correct. " : "Not quite. "}
                  </span>
                  {m.turn.explanation}
                </p>
              )}
            </div>
          ) : (
            <p key={i} className="rounded-2xl rounded-bl-md bg-background px-3 py-2 text-foreground">{m.turn.reply}</p>
          )
        )}
        {pendingQ && (
          <div className="self-start rounded-2xl rounded-bl-md bg-background px-3 py-2"><StatusLine text="Your coach is thinking…" /></div>
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
          placeholder="Ask, or type your answer…"
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
