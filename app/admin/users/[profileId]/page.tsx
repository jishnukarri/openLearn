import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentOverview } from "@/lib/supabase/student-analytics";
import { listAuditForTarget } from "@/lib/supabase/admin-audit";
import { getStudentActivity } from "@/lib/supabase/student-activity";
import { parseFilter } from "@/lib/student-activity";
import { StudentActivityTimeline } from "@/components/student-activity-timeline";
import { StudentProgress } from "@/components/student-progress";
import { createServerUsers } from "@/lib/appwrite/server";
import { readMustChangePassword } from "@/lib/password-policy";
import { getBlockMatch } from "@/lib/supabase/blocklist";
import { SupportPanel } from "./support-panel";

export default async function AdminUserPage({ params, searchParams }: { params: Promise<{ profileId: string }>; searchParams: Promise<{ activity?: string; before?: string }> }) {
  await requireRole("admin");
  const { profileId } = await params;
  const sp = await searchParams;
  if (!isUuid(profileId)) notFound();
  const filter = parseFilter(sp.activity);
  const overview = await getStudentOverview(profileId);
  if (!overview) notFound();
  const audit = await listAuditForTarget(profileId).catch(() => []);
  const page = await getStudentActivity(profileId, { before: sp.before, filter, includeAdmin: true });
  const mustChange = await createServerUsers()
    .getPrefs({ userId: overview.profile.appwrite_user_id })
    .then((prefs) => readMustChangePassword(prefs as Record<string, unknown>))
    .catch(() => false);
  const blocked = await getBlockMatch("email", overview.profile.email).catch(() => null);
  const notices = [
    mustChange ? "This account must choose a new password the next time it logs in." : null,
    blocked ? "This email is on the blocklist." : null,
  ].filter((n): n is string => n !== null);
  return (
    <StudentProgress
      overview={overview}
      accountNotice={
        notices.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-base text-foreground" role="status">
            {notices.map((n) => (
              <li key={n} className="border-l-2 border-error pl-3">{n}</li>
            ))}
          </ul>
        ) : null
      }
      activity={
        <StudentActivityTimeline events={page.events} nextBefore={page.nextBefore} filter={filter} basePath={`/admin/users/${profileId}`} isFirstPage={!sp.before} />
      }
      supportPanel={<SupportPanel profileId={profileId} email={overview.profile.email} audit={audit} />}
    />
  );
}
