import "server-only";
import { db } from "./database-client";
import type { Profile } from "./profiles";

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await db
    .from("profiles")
    .select("id, appwrite_user_id, email, full_name, role, xp, streak_count")
    .order("email");

  if (error) throw error;
  return data;
}

export async function updateProfileRole(
  profileId: string,
  role: "admin" | "teacher" | "student" | "pending_teacher"
): Promise<void> {
  const { error } = await db
    .from("profiles")
    .update({ role })
    .eq("id", profileId);
  if (error) throw error;
}

// Returns the Appwrite user id so the caller can delete the Appwrite
// account too, then deletes the Supabase profile row (cascading to
// progress, answers, and class memberships via the DB foreign keys) —
// same cleanup as self-service deleteAccountAction, just admin-triggered
// against someone else's profile id instead of the caller's own session.
export async function deleteProfileById(
  profileId: string
): Promise<{ appwriteUserId: string } | null> {
  const { data, error: fetchError } = await db
    .from("profiles")
    .select("appwrite_user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!data) return null;

  const { error } = await db.from("profiles").delete().eq("id", profileId);
  if (error) throw error;

  return { appwriteUserId: data.appwrite_user_id };
}
