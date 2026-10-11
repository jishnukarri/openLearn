import { requireRole } from "@/lib/appwrite/session";
import { listOpenReports } from "@/lib/supabase/reports";
import { resolveReportAction } from "@/app/actions/reports";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

export default async function AdminReportsPage() {
  await requireRole("admin");
  const reports = await listOpenReports();

  const times = reports.map((r) => new Date(r.createdAt).getTime());
  const oldest = times.length > 0 ? new Date(Math.min(...times)) : null;
  const newest = times.length > 0 ? new Date(Math.max(...times)) : null;

  return (
    <PageShell
      size="fluid"
      aside={
        <AsideBlock title="Queue">
          <dl className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <dt>Open reports</dt>
              <dd className="font-[family-name:var(--font-mono)] text-foreground">{reports.length}</dd>
            </div>
            {oldest && newest && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt>Oldest</dt>
                  <dd className="text-foreground">{oldest.toLocaleDateString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Latest</dt>
                  <dd className="text-foreground">{newest.toLocaleDateString()}</dd>
                </div>
              </>
            )}
          </dl>
          <p>Marking a report resolved removes it from this queue.</p>
        </AsideBlock>
      }
    >
      <PageHeader
        title="Content reports"
        description="Issues students and teachers have flagged on lessons and questions."
      />

      {reports.length === 0 ? (
        <p className="text-sm text-muted">No open reports, nothing flagged right now.</p>
      ) : (
        <Stagger>
          <Rise>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {reports.map((report) => (
                <li key={report.id} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground">{report.contextLabel}</p>
                      <p className="text-sm text-muted">
                        {report.reporterName} &middot; {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <form action={resolveReportAction}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                        Mark resolved
                      </Button>
                    </form>
                  </div>
                  <p className="max-w-[65ch] text-sm text-foreground">{report.message}</p>
                </li>
              ))}
            </ul>
          </Rise>
        </Stagger>
      )}
    </PageShell>
  );
}
