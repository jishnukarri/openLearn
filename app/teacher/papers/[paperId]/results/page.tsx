import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getRosterForPaper } from "@/lib/supabase/papers";
import { getSubmissionsForPaper } from "@/lib/supabase/paper-submissions";
import { reassignSubmissionAction, markPendingSubmissionsAction } from "@/app/actions/paper-marking";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

const STATUS_LABEL: Record<string, string> = {
  marked: "Marked",
  pending: "Not marked yet",
  unmatched: "Needs reconciling",
  error: "Marking failed",
};

const STATUS_TONE: Record<string, string> = {
  marked: "border-success/40 text-success",
  pending: "border-highlight/40 text-highlight",
  unmatched: "border-error/40 text-error",
  error: "border-error/40 text-error",
};

export default async function PaperResultsPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();

  const [submissions, roster] = await Promise.all([
    getSubmissionsForPaper(paperId),
    getRosterForPaper(paperId),
  ]);
  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  const countBy = (status: string) => submissions.filter((s) => s.status === status).length;

  return (
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="Summary">
            <dl className="flex flex-col gap-2">
              {Object.keys(STATUS_LABEL).map((status) => (
                <div key={status} className="flex items-center justify-between">
                  <dt>{STATUS_LABEL[status]}</dt>
                  <dd className="font-[family-name:var(--font-mono)] text-foreground">{countBy(status)}</dd>
                </div>
              ))}
            </dl>
          </AsideBlock>
          <AsideBlock title="Reading the list">
            <p>Submissions marked &ldquo;Needs reconciling&rdquo; had no matching reference code. Assign them to a roster student and they are marked straight away.</p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title={`Results: ${paper.title}`}
        description={`${submissions.length} submission${submissions.length === 1 ? "" : "s"} split from the upload.`}
        actions={
          pendingCount > 0 ? (
            <form action={markPendingSubmissionsAction}>
              <input type="hidden" name="paperId" value={paperId} />
              <Button type="submit" size="compact">
                Mark {pendingCount} pending submission{pendingCount === 1 ? "" : "s"}
              </Button>
            </form>
          ) : undefined
        }
      />

      {submissions.length === 0 ? (
        <p className="text-sm text-muted">
          No submissions yet, go to Mark submissions to upload student scripts.
        </p>
      ) : (
        <Stagger className="flex flex-col gap-2" delay={0.1} gap={0.04}>
          {submissions.map((s) => (
            <Rise key={s.id}>
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-medium text-foreground">
                      {s.displayName ?? (s.detectedReferenceCode ? `Code: ${s.detectedReferenceCode}` : "No code detected")}
                    </p>
                    {s.status === "marked" && (
                      <p className="text-sm text-muted">
                        {s.totalMarksAwarded} / {s.totalPossibleMarks} marks
                      </p>
                    )}
                    {s.status === "error" && s.errorMessage && (
                      <p className="text-sm text-error">{s.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-3 py-1 text-sm ${STATUS_TONE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                    {s.status === "marked" && (
                      <Link
                        href={`/teacher/papers/${paperId}/results/${s.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View feedback
                      </Link>
                    )}
                  </div>
                </div>

                {s.status === "unmatched" && (
                  <form action={reassignSubmissionAction} className="flex items-center gap-2 border-t border-border pt-2">
                    <input type="hidden" name="paperId" value={paperId} />
                    <input type="hidden" name="submissionId" value={s.id} />
                    <select
                      name="rosterEntryId"
                      aria-label="Roster student for this submission"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    >
                      {roster.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.displayName} ({r.referenceCode})
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                      Assign &amp; mark
                    </Button>
                  </form>
                )}
              </div>
            </Rise>
          ))}
        </Stagger>
      )}
    </PageShell>
  );
}
