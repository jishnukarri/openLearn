import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper } from "@/lib/supabase/papers";
import { getSubmission, getSubmissionAnswers, getSubmissionsForPaper } from "@/lib/supabase/paper-submissions";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ paperId: string; submissionId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId, submissionId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();

  const submission = await getSubmission(submissionId);
  if (!submission || submission.paperId !== paperId) notFound();

  const [answers, submissions] = await Promise.all([
    getSubmissionAnswers(submissionId),
    getSubmissionsForPaper(paperId),
  ]);
  const displayName = submissions.find((s) => s.id === submissionId)?.displayName ?? "Student";

  return (
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="Score">
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
              {submission.totalMarksAwarded} / {submission.totalPossibleMarks}
            </p>
            <p>{answers.length} question{answers.length === 1 ? "" : "s"} matched in this script.</p>
          </AsideBlock>
          <AsideBlock title="Navigate">
            <Link href={`/teacher/papers/${paperId}/results`} className="text-primary hover:underline">
              Back to all results
            </Link>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title={`${displayName}, ${paper.title}`}
        description={`${submission.totalMarksAwarded} / ${submission.totalPossibleMarks} marks`}
      />

      <Stagger className="flex flex-col gap-3" delay={0.1} gap={0.05}>
        {answers.map((a) => (
          <Rise key={a.id}>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-muted">
                Question {a.questionNumber} · {a.marksAwarded} / {a.maxMarks}{" "}
                {a.maxMarks === 1 ? "mark" : "marks"}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {a.feedback.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 ${f.met ? "text-success" : "text-error"}`}>
                      {f.met ? <Check className="size-4" strokeWidth={2.5} aria-label="Met" /> : <X className="size-4" strokeWidth={2.5} aria-label="Not met" />}
                    </span>
                    <div>
                      <p className="text-foreground">{f.point}</p>
                      <p className="text-sm text-muted">{f.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Rise>
        ))}
      </Stagger>
      {answers.length === 0 && (
        <p className="text-sm text-muted">
          No questions were matched in this student&apos;s script.
        </p>
      )}
    </PageShell>
  );
}
