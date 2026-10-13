import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentOverview } from "@/lib/supabase/student-analytics";
import { listAuditForTarget } from "@/lib/supabase/admin-audit";
import { StudentProgress } from "@/components/student-progress";
import { SupportPanel } from "./support-panel";

export default async function AdminUserPage({ params }: { params: Promise<{ profileId: string }> }) {
  await requireRole("admin");
  const { profileId } = await params;
  const overview = await getStudentOverview(profileId);
  if (!overview) notFound();
  const audit = await listAuditForTarget(profileId).catch(() => []);
  return (
    <StudentProgress
      overview={overview}
      supportPanel={<SupportPanel profileId={profileId} email={overview.profile.email} audit={audit} />}
    />
  );
}
