import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getSubtopic } from "@/lib/supabase/topics";
import { resolveQuestionForSubtopic } from "@/lib/subtopic-content";
import { toClientFormat } from "@/lib/question-client";
import { AnswerForm } from "../../[topicId]/answer-form";
import { ReportButton } from "@/components/report-button";

export default async function SubtopicPracticePage({
  params,
}: {
  params: Promise<{ subtopicId: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { subtopicId } = await params;

  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) notFound();

  const question = await resolveQuestionForSubtopic(subtopic, profile.id);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-xs text-highlight">
          Previewing as {profile.role}, answers here won&apos;t earn XP.
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {subtopic.topic.subject.name} · {subtopic.name}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          {question.prompt}
        </h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-highlight">
          {question.max_marks} marks
        </p>
      </div>

      <ReportButton
        contextLabel={`Practice question: ${subtopic.name}`}
        subtopicId={subtopicId}
        questionId={question.id}
      />

      <AnswerForm
        topicId={subtopicId}
        refTopicId={subtopic.topic.id}
        mode="subtopic"
        questionId={question.id}
        format={toClientFormat(question.format)}
        maxMarks={question.max_marks}
      />
    </main>
  );
}
