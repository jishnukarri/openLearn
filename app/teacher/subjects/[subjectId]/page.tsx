import { SubjectDetailPage } from "@/app/admin/subjects/[subjectId]/page";
import { requireOwnerOrAdmin } from "@/lib/appwrite/session";

export default async function TeacherSubjectDetailPage(props: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ board?: string }>;
}) {
  return SubjectDetailPage({
    ...props,
    basePath: "/teacher/subjects",
    requireAccess: requireOwnerOrAdmin,
  });
}
