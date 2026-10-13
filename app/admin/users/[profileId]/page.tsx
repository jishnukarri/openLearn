import { notFound } from "next/navigation";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentOverview } from "@/lib/supabase/student-analytics";
import { StudentProgress } from "@/components/student-progress";

// SLOT: the support-actions panel lives in ./support-panel.tsx (built separately).
// It is only rendered if that file exists.
async function loadSupportPanel(profileId: string) {
  if (!existsSync(join(process.cwd(), "app/admin/users/[profileId]/support-panel.tsx"))) return null;
  try {
    // @ts-ignore -- optional module, may not exist yet
    const mod = await import("./support-panel");
    const Panel = mod.SupportPanel ?? mod.default;
    return Panel ? <Panel profileId={profileId} /> : null;
  } catch {
    return null;
  }
}

export default async function AdminUserPage({ params }: { params: Promise<{ profileId: string }> }) {
  await requireRole("admin");
  const { profileId } = await params;
  const overview = await getStudentOverview(profileId);
  if (!overview) notFound();
  return <StudentProgress overview={overview} supportPanel={await loadSupportPanel(profileId)} />;
}
