import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import {
  getSessionResultsByTopic,
  getSessionQuestionReviews,
  isDiagnosticSessionOwner,
} from "@/lib/supabase/diagnostic";
import { Button } from "@/components/button";
import { CelebrateOnMount } from "@/components/celebrate-on-mount";
import { StarRating } from "@/components/star-rating";

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

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-10 px-6 py-16">
      <CelebrateOnMount when={overall >= 0.8} />

      {/* Overall summary */}
      <div className="animate-fade-slide-up flex flex-col items-center text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Here&apos;s where you&apos;re at
        </h1>
        <div className="mt-4">
          <StarRating score={overall} size={34} />
        </div>
        <p className="mt-2 max-w-sm text-sm text-muted">
          {overall >= 0.7
            ? "Good foundation overall, we'll move quickly through what you already know and spend more time where it counts."
            : "That's genuinely useful to know now, not halfway through the syllabus. We'll reteach the shaky spots properly instead of assuming you've got them."}
        </p>
      </div>

      {/* Topic breakdown */}
      <div className="flex flex-col gap-2">
        {results.map((r, i) => {
          const v = verdict(r.score);
          return (
            <div
              key={r.topicName}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`animate-fade-slide-up flex items-center justify-between rounded-xl border p-4 ${
                v.tone === "success"
                  ? "border-success/40 bg-success/10"
                  : v.tone === "error"
                    ? "border-error/40 bg-error/10"
                    : "border-highlight/40 bg-highlight/10"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{r.topicName}</p>
                <p
                  className={`text-xs ${
                    v.tone === "success"
                      ? "text-success"
                      : v.tone === "error"
                        ? "text-error"
                        : "text-highlight"
                  }`}
                >
                  {v.label}
                </p>
              </div>
              <StarRating score={r.score} size={16} />
            </div>
          );
        })}
      </div>

      {/* Per-question review */}
      {reviews.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Question review
          </h2>
          {reviews.map((q, i) => {
            // q.score is already a 0–1 fraction (see getSessionQuestionReviews) —
            // dividing by maxMarks again here previously crushed every
            // question with maxMarks > 1 (match/short_answer) toward 0.
            const fraction = q.score;
            const got = Math.round(q.score * q.maxMarks);
            const isCorrect = fraction >= 1;
            const isPartial = fraction > 0 && fraction < 1;
            return (
              <details
                key={q.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="animate-fade-slide-up rounded-xl border border-border bg-surface"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs font-bold ${
                      isCorrect
                        ? "bg-success/20 text-success"
                        : isPartial
                          ? "bg-highlight/20 text-highlight"
                          : "bg-error/20 text-error"
                    }`}
                  >
                    {isCorrect ? "✓" : isPartial ? "~" : "✗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{q.prompt}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {q.topicName} · {scoreLabel(q.score, q.maxMarks)}
                    </p>
                  </div>
                </summary>
                <div className="flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3 text-sm">
                  {q.answerText && (
                    <div>
                      <p className="text-xs font-medium text-muted">Your answer</p>
                      <p className="mt-1 text-foreground">{q.answerText}</p>
                    </div>
                  )}
                  {q.correctAnswer && (
                    <div>
                      <p className="text-xs font-medium text-muted">
                        {isCorrect ? "Correct answer" : "Correct answer was"}
                      </p>
                      <p className="mt-1 text-success">{q.correctAnswer}</p>
                    </div>
                  )}
                  {q.type === "short_answer" && (
                    <p className="text-xs text-muted">
                      Marked by AI · {got} of {q.maxMarks}{" "}
                      {q.maxMarks === 1 ? "mark" : "marks"}
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <Link href="/dashboard">
        <Button>Take me to my dashboard</Button>
      </Link>
    </main>
  );
}
