import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentOverview, teacherCanViewStudent } from "@/lib/supabase/student-analytics";
import { StudentProgress } from "@/components/student-progress";

export default async function TeacherStudentPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profile } = await requireRole("teacher");
  const { profileId } = await params;
  if (!(await teacherCanViewStudent(profile.id, profileId))) notFound();
  const overview = await getStudentOverview(profileId);
  if (!overview) notFound();
  return <StudentProgress overview={overview} />;
}
