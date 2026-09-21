import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getRosterForPaper } from "@/lib/supabase/papers";
import { getSubmissionsForPaper } from "@/lib/supabase/paper-submissions";
import { reassignSubmissionAction, markPendingSubmissionsAction } from "@/app/actions/paper-marking";
import { Button } from "@/components/button";

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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
            Results: {paper.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {submissions.length} submission{submissions.length === 1 ? "" : "s"} split from the upload.
          </p>
        </div>
        {pendingCount > 0 && (
          <form action={markPendingSubmissionsAction} className="shrink-0">
            <input type="hidden" name="paperId" value={paperId} />
            <Button type="submit" size="compact">
              Mark {pendingCount} pending submission{pendingCount === 1 ? "" : "s"}
            </Button>
          </form>
        )}
      </div>

      {submissions.length === 0 ? (
        <p className="text-sm text-muted">
          No submissions yet, go to Mark submissions to upload student scripts.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {submissions.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {s.displayName ?? (s.detectedReferenceCode ? `Code: ${s.detectedReferenceCode}` : "No code detected")}
                  </p>
                  {s.status === "marked" && (
                    <p className="text-xs text-muted">
                      {s.totalMarksAwarded} / {s.totalPossibleMarks} marks
                    </p>
                  )}
                  {s.status === "error" && s.errorMessage && (
                    <p className="text-xs text-error">{s.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs ${STATUS_TONE[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                  {s.status === "marked" && (
                    <Link
                      href={`/teacher/papers/${paperId}/results/${s.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View feedback →
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
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
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
          ))}
        </div>
      )}
    </main>
  );
}
