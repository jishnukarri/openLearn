"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

// Fixed, hand-authored examples — no live AI call. This is a landing-page
// demo of "The Markup" (see DESIGN.md), not a real marking tool: any
// visitor could hit it with zero friction, so it must cost nothing per
// view. A real marking flow only ever runs for someone with an account.
type Token = { text: string; status?: "hit" | "miss" };
type MarkPoint = { met: boolean; comment: string };

type Example = {
  subject: string;
  question: string;
  answer: Token[];
  points: MarkPoint[];
  score: string;
};

const EXAMPLES: Example[] = [
  {
    subject: "Chemistry",
    question: "Explain why metals are good conductors of electricity.",
    answer: [
      { text: "Metals are conductors because " },
      { text: "they have delocalised electrons", status: "hit" },
      { text: " which are " },
      { text: "free to move throughout the metal structure", status: "hit" },
      { text: ". This is because metal is shiny and heavy, which lets electricity pass through it easily.", status: "miss" },
    ],
    points: [
      { met: true, comment: "Correctly identifies delocalised electrons." },
      { met: true, comment: "Correctly explains they can move freely through the structure." },
      { met: false, comment: "\"Shiny and heavy\" isn't why metals conduct — this doesn't explain the mechanism, so no mark here." },
    ],
    score: "2/3",
  },
  {
    subject: "Biology",
    question: "Describe how the structure of an alveolus is adapted for gas exchange.",
    answer: [
      { text: "The alveolus has a " },
      { text: "thin wall, which is only one cell thick", status: "hit" },
      { text: ", so gases have a short diffusion distance. It is also " },
      { text: "surrounded by a network of capillaries", status: "hit" },
      { text: " to maintain a steep concentration gradient. Alveoli are found in the lungs, which are in the chest.", status: "miss" },
    ],
    points: [
      { met: true, comment: "Thin walls, short diffusion pathway — correctly explained." },
      { met: true, comment: "Good use of the capillary network maintaining the concentration gradient." },
      { met: false, comment: "Where the lungs are located doesn't answer the question — this is restating the question, not new content." },
    ],
    score: "2/3",
  },
];

function AnnotatedAnswer({ tokens }: { tokens: Token[] }) {
  return (
    <p className="text-base leading-loose text-foreground">
      {tokens.map((t, i) =>
        t.status === "hit" ? (
          <span
            key={i}
            className="rounded-md border-b-2 border-success bg-success/10 px-0.5 font-medium"
          >
            {t.text}
          </span>
        ) : t.status === "miss" ? (
          <span key={i} className="text-error line-through decoration-2">
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        )
      )}
    </p>
  );
}

export function MarkupDemo() {
  const [active, setActive] = useState(0);
  const example = EXAMPLES[active];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex justify-center gap-2">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex.subject}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              active === i
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {ex.subject}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-black/10">
        <div className="border-b border-border bg-surface px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {example.subject} · exam question
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{example.question}</p>
        </div>

        <div className="grid gap-0 sm:grid-cols-[1fr_15rem]">
          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Student&apos;s answer
            </p>
            <AnnotatedAnswer tokens={example.answer} />
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-surface p-6 sm:border-l sm:border-t-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Markscheme</p>
              <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-primary">
                {example.score}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {example.points.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  {p.met ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-error" strokeWidth={2.5} />
                  )}
                  <p className="text-xs leading-relaxed text-muted">{p.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-2xs text-muted">
        A real, worked example — marked strictly against the exam board&apos;s own markscheme, the way every answer on openLearn is marked.
      </p>
    </div>
  );
}
