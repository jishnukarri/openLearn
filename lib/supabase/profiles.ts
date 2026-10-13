import "server-only";
import { db } from "./database-client";

export type ProfileRole = "admin" | "teacher" | "student" | "pending_teacher";

export type Profile = {
  id: string;
  appwrite_user_id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  xp: number;
  streak_count: number;
};

export async function getProfileById(profileId: string): Promise<(Profile & { created_at: string; last_active_date: string | null }) | null> {
  const { data, error } = await db
    .from("profiles")
    .select("id, appwrite_user_id, email, full_name, role, xp, streak_count, created_at, last_active_date")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileByAppwriteId(
  appwriteUserId: string
): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("id, appwrite_user_id, email, full_name, role, xp, streak_count")
    .eq("appwrite_user_id", appwriteUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfileName(
  profileId: string,
  fullName: string
): Promise<void> {
  const { error } = await db
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", profileId);
  if (error) throw error;
}

export async function deleteProfile(profileId: string): Promise<void> {
  const { error } = await db.from("profiles").delete().eq("id", profileId);
  if (error) throw error;
}

export async function createProfile(input: {
  appwriteUserId: string;
  email: string;
  fullName: string;
  role?: ProfileRole;
}): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .insert({
      appwrite_user_id: input.appwriteUserId,
      email: input.email,
      full_name: input.fullName,
      role: input.role ?? "student",
    })
    .select("id, appwrite_user_id, email, full_name, role, xp, streak_count")
    .single();

  if (error) throw error;
  return data;
}
