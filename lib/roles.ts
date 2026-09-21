import type { ProfileRole } from "@/lib/supabase/profiles";

export function canManageSubject(
  profile: { id: string; role: ProfileRole },
  subject: { created_by: string }
): boolean {
  if (profile.role === "admin") return true;
  return profile.role === "teacher" && subject.created_by === profile.id;
}

export function roleHome(role: ProfileRole | undefined): string {
  switch (role) {
    case "student":
      return "/onboarding";
    case "teacher":
      return "/teacher/classes";
    case "admin":
      return "/admin/subjects";
    case "pending_teacher":
      return "/pending-approval";
    default:
      return "/";
  }
}
