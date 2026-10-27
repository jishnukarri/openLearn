"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import { updateProfileRole, deleteProfileById } from "@/lib/supabase/admin-users";
import { createServerUsers } from "@/lib/appwrite/server";
import { isUuid } from "@/lib/ids";
import { logAdminAction } from "@/lib/supabase/admin-audit";

export async function updateRoleAction(formData: FormData): Promise<void> {
  const { profile: admin } = await requireRole("admin");

  const profileId = formData.get("profileId");
  const role = formData.get("role");
  if (typeof profileId !== "string" || typeof role !== "string") {
    throw new Error("Missing profileId or role.");
  }
  if (!["admin", "teacher", "student", "pending_teacher"].includes(role)) {
    throw new Error("Invalid role.");
  }

  if (!isUuid(profileId)) throw new Error("Invalid profileId.");
  // An admin demoting themselves could leave the platform with no admin.
  if (profileId === admin.id) throw new Error("You can't change your own role.");

  await updateProfileRole(profileId, role as "admin" | "teacher" | "student" | "pending_teacher");
  try {
    await logAdminAction({ adminId: admin.id, targetId: profileId, action: "change_role", reason: `role set to ${role}` });
  } catch {
    console.warn("admin_audit_log unavailable; role change was not recorded.");
  }
  revalidatePath("/admin/users");
}

// Admin-triggered account deletion for another user — same cleanup as the
// self-service version (lib/supabase/admin-users.ts's deleteProfileById
// cascades progress/answers/class memberships), plus removing their
// Appwrite account so they can't just log back in.
export async function deleteUserAccountAction(formData: FormData): Promise<void> {
  const { profile: admin } = await requireRole("admin");

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string") throw new Error("Missing profileId.");
  if (!isUuid(profileId)) throw new Error("Invalid profileId.");
  if (profileId === admin.id) {
    throw new Error("You can't delete your own account from here.");
  }

  const deleted = await deleteProfileById(profileId);
  if (deleted) {
    try {
      await createServerUsers().delete(deleted.appwriteUserId);
    } catch {
      // Appwrite user already gone or delete failed — the profile row is
      // gone either way, so don't block on this.
    }
  }

  revalidatePath("/admin/users");
}
