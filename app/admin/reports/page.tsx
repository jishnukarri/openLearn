import { requireRole } from "@/lib/appwrite/session";
import { listOpenReports } from "@/lib/supabase/reports";
import { resolveReportAction } from "@/app/actions/reports";
import { Button } from "@/components/button";

export default async function AdminReportsPage() {
  await requireRole("admin");
  const reports = await listOpenReports();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Content reports
        </h1>
        <p className="mt-1 text-sm text-muted">
          Issues students and teachers have flagged on lessons and questions.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-muted">No open reports, nothing flagged right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{report.contextLabel}</p>
                  <p className="text-xs text-muted">
                    {report.reporterName} · {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <form action={resolveReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                    Mark resolved
                  </Button>
                </form>
              </div>
              <p className="text-sm text-foreground">{report.message}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
