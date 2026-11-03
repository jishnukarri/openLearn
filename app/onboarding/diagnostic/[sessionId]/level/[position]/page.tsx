import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getDiagnosticQuestions, isDiagnosticSessionOwner } from "@/lib/supabase/diagnostic";
import { toClientDiagnosticQuestion } from "@/lib/diagnostic-client";
import { LevelForm } from "./level-form";
import { LevelShell } from "./level-shell";

export default async function DiagnosticLevelPage({
  params,
}: {
  params: Promise<{ sessionId: string; position: string }>;
}) {
  const { profile } = await requireRole("student");
  const { sessionId, position: positionParam } = await params;
  const position = Number(positionParam);
  if (!Number.isInteger(position) || position < 0) notFound();

  if (!(await isDiagnosticSessionOwner(sessionId, profile.id))) notFound();

  const questions = await getDiagnosticQuestions(sessionId);
  if (position >= questions.length) redirect(`/onboarding/diagnostic/${sessionId}/results`);

  const question = questions[position];
  if (!question) notFound();

  const isLast = position === questions.length - 1;
  // Use the type the form will render: a numeric question is stored as fill_blank.
  const clientQuestion = toClientDiagnosticQuestion(question);

  return (
    <LevelShell
      position={position}
      total={questions.length}
      unitLabel="Level"
      topicName={question.topic_name ?? null}
      prompt={question.prompt}
      showPrompt={clientQuestion.type !== "fill_blank"}
      maxMarks={question.max_marks}
    >
      <LevelForm
        sessionId={sessionId}
        position={position}
        isLast={isLast}
        question={clientQuestion}
      />
    </LevelShell>
  );
}
