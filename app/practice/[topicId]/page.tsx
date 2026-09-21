import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { resolveQuestionContent } from "@/lib/class-content";
import { toClientFormat } from "@/lib/question-client";
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
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-xs text-highlight">
          Previewing as {profile.role}, answers here won&apos;t earn XP.
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {topic.subject.name} · {topic.name}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          Practice
        </h1>
      </div>

      {bank.length > 0 ? (
        <BankPracticePlayer bank={bank} topicId={topicId} />
      ) : fallbackQuestion ? (
        <>
          <div>
            <h2 className="mt-2 text-lg text-foreground">{fallbackQuestion.prompt}</h2>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-highlight">
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
    </main>
  );
}
