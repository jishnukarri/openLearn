"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import { updateProfileRole, deleteProfileById } from "@/lib/supabase/admin-users";
import { createServerUsers } from "@/lib/appwrite/server";

export async function updateRoleAction(formData: FormData): Promise<void> {
  await requireRole("admin");

  const profileId = formData.get("profileId");
  const role = formData.get("role");
  if (typeof profileId !== "string" || typeof role !== "string") {
    throw new Error("Missing profileId or role.");
  }
  if (!["admin", "teacher", "student", "pending_teacher"].includes(role)) {
    throw new Error("Invalid role.");
  }

  await updateProfileRole(profileId, role as "admin" | "teacher" | "student" | "pending_teacher");
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
