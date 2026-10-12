import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { requireRole } from "@/lib/appwrite/session";
import {
  getSessionResultsByTopic,
  getSessionQuestionReviews,
  isDiagnosticSessionOwner,
} from "@/lib/supabase/diagnostic";
import { Button } from "@/components/button";
import { CelebrateOnMount } from "@/components/celebrate-on-mount";
import { StarRating } from "@/components/star-rating";
import { Rise, Stagger } from "@/components/motion";
import { CountUp, ScoreBar } from "@/components/results-motion";

function verdict(score: number): { label: string; tone: "success" | "highlight" | "error" } {
  if (score >= 0.8) return { label: "Strong, you've got this", tone: "success" };
  if (score >= 0.6) return { label: "Solid, with room to sharpen", tone: "highlight" };
  return { label: "Let's rebuild this one together", tone: "error" };
}

function scoreLabel(score: number, maxMarks: number): string {
  const marks = Math.round(score * maxMarks);
  return `${marks} / ${maxMarks}`;
}

export default async function DiagnosticResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { profile } = await requireRole("student");
  const { sessionId } = await params;

  if (!(await isDiagnosticSessionOwner(sessionId, profile.id))) notFound();

  const [results, reviews] = await Promise.all([
    getSessionResultsByTopic(sessionId),
    getSessionQuestionReviews(sessionId),
  ]);

  const overall =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length
      : 0;

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 lg:py-14">
      <CelebrateOnMount when={overall >= 0.8} />

      <Stagger className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start">
        {/* Overall summary */}
        <Rise className="flex flex-col items-start gap-5 lg:sticky lg:top-24">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl lg:leading-[1.1]">
            Here&apos;s where you&apos;re at
          </h1>
          <div className="flex w-full flex-col items-center gap-3 self-center lg:items-start lg:self-start">
            <CountUp
              value={Math.round(overall * 100)}
              className="font-[family-name:var(--font-mono)] text-6xl font-semibold tabular-nums text-foreground"
            />
            <StarRating score={overall} size={34} />
          </div>
          {results.length > 1 && (
            <dl className="flex max-w-[44ch] flex-col gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted">Strongest:</dt>
                <dd className="font-medium text-success">{strongest.topicName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">Most to gain:</dt>
                <dd className="font-medium text-highlight">{weakest.topicName}</dd>
              </div>
            </dl>
          )}
          <p className="max-w-[44ch] text-base text-muted">
            {overall >= 0.7
              ? "Good foundation overall, we'll move quickly through what you already know and spend more time where it counts."
              : "That's genuinely useful to know now, not halfway through the syllabus. We'll reteach the shaky spots properly instead of assuming you've got them."}
          </p>
          <Link href="/dashboard">
            <Button>Take me to my dashboard</Button>
          </Link>
        </Rise>

        <div className="flex min-w-0 flex-col gap-10">
          {/* Topic breakdown */}
          <Rise>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {results.map((r, idx) => {
                const v = verdict(r.score);
                return (
                  <li key={r.topicName} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-foreground">{r.topicName}</p>
                      <p
                        className={`text-sm ${
                          v.tone === "success"
                            ? "text-success"
                            : v.tone === "error"
                              ? "text-error"
                              : "text-highlight"
                        }`}
                      >
                        {v.label}
                      </p>
                      <div className="mt-2 max-w-xs">
                        <ScoreBar score={r.score} tone={v.tone} delay={idx * 0.08} />
                      </div>
                    </div>
                    <StarRating score={r.score} size={18} />
                  </li>
                );
              })}
            </ul>
          </Rise>

          {/* Per-question review */}
          {reviews.length > 0 && (
            <Rise className="flex flex-col gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
                Question review
              </h2>
              <div className="flex flex-col divide-y divide-border">
                {reviews.map((q) => {
                  // q.score is already a 0–1 fraction (see getSessionQuestionReviews) —
                  // dividing by maxMarks again here previously crushed every
                  // question with maxMarks > 1 (match/short_answer) toward 0.
                  const fraction = q.score;
                  const got = Math.round(q.score * q.maxMarks);
                  const isCorrect = fraction >= 1;
                  const isPartial = fraction > 0 && fraction < 1;
                  return (
                    <details key={q.id} className="group">
                      <summary className="flex cursor-pointer list-none items-start gap-3 py-4">
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                            isCorrect
                              ? "bg-success/20 text-success"
                              : isPartial
                                ? "bg-highlight/20 text-highlight"
                                : "bg-error/20 text-error"
                          }`}
                        >
                          {isCorrect ? (
                            <Check className="size-3" strokeWidth={2.5} />
                          ) : isPartial ? (
                            <Minus className="size-3" strokeWidth={2.5} />
                          ) : (
                            <X className="size-3" strokeWidth={2.5} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-base text-foreground">{q.prompt}</p>
                          <p className="mt-0.5 text-sm text-muted">
                            {q.topicName} · {scoreLabel(q.score, q.maxMarks)}
                          </p>
                        </div>
                      </summary>
                      <div className="flex flex-col gap-3 pb-4 pl-8 text-sm">
                        {q.answerText && (
                          <div>
                            <p className="text-sm font-medium text-muted">Your answer</p>
                            <p className="mt-1 text-foreground">{q.answerText}</p>
                          </div>
                        )}
                        {q.correctAnswer && (
                          <div>
                            <p className="text-sm font-medium text-muted">
                              {isCorrect ? "Correct answer" : "Correct answer was"}
                            </p>
                            <p className="mt-1 text-success">{q.correctAnswer}</p>
                          </div>
                        )}
                        {q.type === "short_answer" && (
                          <p className="text-sm text-muted">
                            Marked by AI · {got} of {q.maxMarks}{" "}
                            {q.maxMarks === 1 ? "mark" : "marks"}
                          </p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </Rise>
          )}
        </div>
      </Stagger>
    </main>
  );
}
