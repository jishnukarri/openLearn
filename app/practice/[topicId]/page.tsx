import { RichText } from "@/components/rich-text";
import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { resolveQuestionContent } from "@/lib/class-content";
import { toClientFormat } from "@/lib/question-client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { AnswerForm } from "./answer-form";
import { BankPracticePlayer } from "./bank-player";
import { ReportButton } from "@/components/report-button";
import { listQuestionBankForTopic } from "@/lib/supabase/questions";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { topicId } = await params;

  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const bank = await listQuestionBankForTopic(topicId);

  // Fall back to single-question mode when no bank has been generated yet
  const fallbackQuestion = bank.length === 0
    ? await resolveQuestionContent(topic, profile)
    : null;

  return (
    <PageShell size="wide">
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-sm text-highlight-ink">
          Previewing as {profile.role}, answers here won&apos;t earn XP.
        </div>
      )}

      <PageHeader title="Practice" description={`${topic.subject.name} · ${topic.name}`} />

      {bank.length > 0 ? (
        <BankPracticePlayer bank={bank} topicId={topicId} />
      ) : fallbackQuestion ? (
        <>
          <div>
            <h2 className="max-w-[65ch] text-xl text-foreground"><RichText text={fallbackQuestion.prompt} /></h2>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-highlight-ink">
              {fallbackQuestion.max_marks} marks
            </p>
          </div>
          <ReportButton
            contextLabel={`Practice question: ${topic.name}`}
            topicId={topicId}
            questionId={fallbackQuestion.id}
          />
          <AnswerForm
            topicId={topicId}
            questionId={fallbackQuestion.id}
            format={toClientFormat(fallbackQuestion.format)}
            maxMarks={fallbackQuestion.max_marks}
          />
        </>
      ) : null}
    </PageShell>
  );
}
