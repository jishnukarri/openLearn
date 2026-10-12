import { RichText } from "@/components/rich-text";
import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getSubtopic } from "@/lib/supabase/topics";
import { resolveQuestionForSubtopic } from "@/lib/subtopic-content";
import { toClientFormat } from "@/lib/question-client";
import { PageShell, PageHeader } from "@/components/page-shell";
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
    <PageShell size="wide">
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-sm text-highlight">
          Previewing as {profile.role}, answers here won&apos;t earn XP.
        </div>
      )}
      <PageHeader title="Practice" description={`${subtopic.topic.subject.name} · ${subtopic.name}`} />

      <div>
        <h2 className="max-w-[65ch] text-xl text-foreground"><RichText text={question.prompt} /></h2>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-highlight">{question.max_marks} marks</p>
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
    </PageShell>
  );
}
