import { notFound, redirect } from "next/navigation";
import { getGuestToken } from "@/lib/guest-session";
import { getDiagnosticQuestions, isGuestSessionOwner } from "@/lib/supabase/diagnostic";
import { toClientDiagnosticQuestion } from "@/lib/diagnostic-client";
import { submitGuestDiagnosticLevelAction } from "@/app/actions/guest";
import { LevelForm } from "@/app/onboarding/diagnostic/[sessionId]/level/[position]/level-form";
import { LevelShell } from "@/app/onboarding/diagnostic/[sessionId]/level/[position]/level-shell";

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

  return (
    <LevelShell
      position={position}
      total={questions.length}
      unitLabel="Question"
      topicName={question.topic_name ?? null}
      prompt={question.prompt}
      showPrompt={question.type !== "fill_blank"}
      maxMarks={question.max_marks}
    >
      <LevelForm
        sessionId={sessionId}
        position={position}
        isLast={isLast}
        question={toClientDiagnosticQuestion(question)}
        action={submitGuestDiagnosticLevelAction}
        backHref={`/start/diagnostic/${sessionId}/level/${position - 1}`}
      />
    </LevelShell>
  );
}
