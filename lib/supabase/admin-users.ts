import "server-only";
import { db } from "./database-client";
import type { Profile } from "./profiles";

export type AdminProfileRow = Profile & { last_active_date: string | null };

export type ProfileRoleFilter = "student" | "teacher" | "admin" | "pending_teacher";

export async function listProfiles(
  opts: { q?: string; role?: ProfileRoleFilter; page?: number; pageSize?: number } = {}
): Promise<{ rows: AdminProfileRow[]; total: number }> {
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, opts.page ?? 1);
  let query = db
    .from("profiles")
    .select("id, appwrite_user_id, email, full_name, role, xp, streak_count, last_active_date", {
      count: "exact",
    })
    .order("email")
    .range((page - 1) * pageSize, page * pageSize - 1);

  // Strip characters that have meaning in PostgREST filter syntax / LIKE.
  const q = opts.q?.replace(/[,()%_\\*]/g, " ").trim();
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (opts.role) query = query.eq("role", opts.role);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as AdminProfileRow[], total: count ?? 0 };
}

export async function countProfilesByRole(): Promise<Record<ProfileRoleFilter, number>> {
  const roles: ProfileRoleFilter[] = ["student", "teacher", "admin", "pending_teacher"];
  const counts = await Promise.all(
    roles.map(async (role) => {
      const { count, error } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", role);
      if (error) throw error;
      return count ?? 0;
    })
  );
  return Object.fromEntries(roles.map((r, i) => [r, counts[i]])) as Record<ProfileRoleFilter, number>;
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
