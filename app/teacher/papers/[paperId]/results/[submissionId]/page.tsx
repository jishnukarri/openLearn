import { notFound } from "next/navigation";
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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          {displayName}, {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {submission.totalMarksAwarded} / {submission.totalPossibleMarks} marks
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {answers.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Question {a.questionNumber} · {a.marksAwarded} / {a.maxMarks}{" "}
              {a.maxMarks === 1 ? "mark" : "marks"}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {a.feedback.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={f.met ? "text-success" : "text-error"}>{f.met ? "✓" : "✗"}</span>
                  <div>
                    <p className="text-foreground">{f.point}</p>
                    <p className="text-xs text-muted">{f.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {answers.length === 0 && (
          <p className="text-sm text-muted">
            No questions were matched in this student&apos;s script.
          </p>
        )}
      </div>
    </main>
  );
}
