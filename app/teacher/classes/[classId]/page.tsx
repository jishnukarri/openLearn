import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getClassOverview } from "@/lib/supabase/student-analytics";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { ClassRoster } from "./class-roster";

export default async function ClassOverviewPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const { profile } = await requireRole("teacher");
  const overview = await getClassOverview(classId, profile.id);
  if (!overview) notFound();

  return (
    <PageShell size="fluid">
      <PageHeader
        title={overview.name}
        description="How each student is getting on."
        actions={
          <Link href="/teacher/classes" className="text-sm text-muted hover:text-foreground hover:underline">
            Back to classes
          </Link>
        }
      />
      <Stagger className="flex flex-col gap-8">
        <Rise>
          {overview.rows.length === 0 ? (
            <p className="max-w-[60ch] text-base text-muted">
              No students have joined this class yet. Go back to your classes, copy the invite code or link, and share
              it with your students. They will appear here once they join.
            </p>
          ) : (
            <ClassRoster rows={overview.rows} />
          )}
        </Rise>
      </Stagger>
    </PageShell>
  );
}
