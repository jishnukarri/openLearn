import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentOverview, teacherCanViewStudent } from "@/lib/supabase/student-analytics";
import { getStudentActivity } from "@/lib/supabase/student-activity";
import { parseFilter } from "@/lib/student-activity";
import { StudentActivityTimeline } from "@/components/student-activity-timeline";
import { StudentProgress } from "@/components/student-progress";

export default async function TeacherStudentPage({ params, searchParams }: { params: Promise<{ profileId: string }>; searchParams: Promise<{ activity?: string; before?: string }> }) {
  const { profile } = await requireRole("teacher");
  const { profileId } = await params;
  const sp = await searchParams;
  const filter = parseFilter(sp.activity);
  if (!(await teacherCanViewStudent(profile.id, profileId))) notFound();
  const overview = await getStudentOverview(profileId);
  if (!overview) notFound();
  const page = await getStudentActivity(profileId, { before: sp.before, filter });
  return (
    <StudentProgress
      overview={overview}
      activity={
        <StudentActivityTimeline events={page.events} nextBefore={page.nextBefore} filter={filter} basePath={`/teacher/students/${profileId}`} isFirstPage={!sp.before} />
      }
    />
  );
}
