import { notFound, redirect } from "next/navigation";
import { getGuestToken } from "@/lib/guest-session";
import { getDiagnosticQuestions, isGuestSessionOwner } from "@/lib/supabase/diagnostic";
import { toClientDiagnosticQuestion } from "@/lib/diagnostic-client";
import { submitGuestDiagnosticLevelAction } from "@/app/actions/guest";
import { ProgressBar } from "@/components/progress-bar";
import { LevelForm } from "@/app/onboarding/diagnostic/[sessionId]/level/[position]/level-form";

const TOPIC_INTROS = [
  "Let's see what you remember about",
  "A few questions on",
  "Time to check your knowledge of",
];

export default async function GuestDiagnosticLevelPage({
  params,
}: {
  params: Promise<{ sessionId: string; position: string }>;
}) {
  const { sessionId, position: positionParam } = await params;
  const position = Number(positionParam);
  if (!Number.isInteger(position) || position < 0) notFound();

  const guestToken = await getGuestToken();
  if (!guestToken || !(await isGuestSessionOwner(sessionId, guestToken))) notFound();

  const questions = await getDiagnosticQuestions(sessionId);
  if (position >= questions.length) redirect(`/start/results/${sessionId}`);

  const question = questions[position];
  if (!question) notFound();

  const isLast = position === questions.length - 1;
  const intro = TOPIC_INTROS[position % TOPIC_INTROS.length];

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <ProgressBar value={position} max={questions.length} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Question {position + 1} of {questions.length}
          {question.topic_name ? ` · ${question.topic_name}` : ""}
        </p>
      </div>

      <div>
        {question.topic_name && (
          <p className="text-xs text-muted">
            {intro} {question.topic_name.toLowerCase()}.
          </p>
        )}
        {question.type !== "fill_blank" && (
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
            {question.prompt}
          </h1>
        )}
        <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-highlight">
          {question.max_marks} {question.max_marks === 1 ? "mark" : "marks"}
        </p>
      </div>

      <LevelForm
        sessionId={sessionId}
        position={position}
        isLast={isLast}
        question={toClientDiagnosticQuestion(question)}
        action={submitGuestDiagnosticLevelAction}
        backHref={`/start/diagnostic/${sessionId}/level/${position - 1}`}
      />
    </main>
  );
}
