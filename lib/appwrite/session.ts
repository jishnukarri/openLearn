import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createSessionClient } from "./server";
import { getProfileByAppwriteId, type ProfileRole } from "@/lib/supabase/profiles";
import { canManageSubject } from "@/lib/roles";
import { getSubject } from "@/lib/supabase/subjects";

export const SESSION_COOKIE = "openlearn_session";

// Verifies the session cookie against Appwrite on every call (memoized per
// request via React's cache). This is a "secure" check, not an optimistic
// one — it round-trips to Appwrite rather than trusting an unsigned cookie.
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const secret = cookieStore.get(SESSION_COOKIE)?.value;
  if (!secret) return null;

  try {
    const account = createSessionClient(secret);
    const user = await account.get();
    return { userId: user.$id, email: user.email, name: user.name };
  } catch {
    return null;
  }
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// Combines the Appwrite session with the matching Supabase profile, and
// 404s (not redirects) on role mismatch — a wrong role shouldn't reveal
// that the route exists.
export const requireRole = cache(async (role: ProfileRole) => {
  const session = await requireSession();
  const profile = await getProfileByAppwriteId(session.userId);
  if (!profile || profile.role !== role) notFound();
  return { session, profile };
});

// Same as requireRole, but accepts any of several roles — for pages like
// the lesson player that a student uses for real and an admin/teacher only
// previews.
export const requireAnyRole = cache(async (roles: ProfileRole[]) => {
  const session = await requireSession();
  const profile = await getProfileByAppwriteId(session.userId);
  if (!profile || !roles.includes(profile.role)) notFound();
  return { session, profile };
});

// Admins pass unconditionally; teachers pass only if they own the subject.
// 404s (not redirects) on mismatch, matching requireRole/requireAnyRole —
// a locked subject shouldn't reveal it exists to a non-owning teacher.
export const requireOwnerOrAdmin = cache(async (subjectId: string) => {
  const { session, profile } = await requireAnyRole(["admin", "teacher"]);
  const subject = await getSubject(subjectId);
  if (!subject || !canManageSubject(profile, subject)) notFound();
  return { session, profile };
});
