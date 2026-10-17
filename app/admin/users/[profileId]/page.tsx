import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentOverview } from "@/lib/supabase/student-analytics";
import { listAuditForTarget } from "@/lib/supabase/admin-audit";
import { getStudentActivity } from "@/lib/supabase/student-activity";
import { parseFilter } from "@/lib/student-activity";
import { StudentActivityTimeline } from "@/components/student-activity-timeline";
import { StudentProgress } from "@/components/student-progress";
import { SupportPanel } from "./support-panel";

export default async function AdminUserPage({ params, searchParams }: { params: Promise<{ profileId: string }>; searchParams: Promise<{ activity?: string; before?: string }> }) {
  await requireRole("admin");
  const { profileId } = await params;
  const sp = await searchParams;
  const filter = parseFilter(sp.activity);
  const overview = await getStudentOverview(profileId);
  if (!overview) notFound();
  const audit = await listAuditForTarget(profileId).catch(() => []);
  const page = await getStudentActivity(profileId, { before: sp.before, filter, includeAdmin: true });
  return (
    <StudentProgress
      overview={overview}
      activity={
        <StudentActivityTimeline events={page.events} nextBefore={page.nextBefore} filter={filter} basePath={`/admin/users/${profileId}`} isFirstPage={!sp.before} />
      }
      supportPanel={<SupportPanel profileId={profileId} email={overview.profile.email} audit={audit} />}
    />
  );
}
