import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { BottomNav } from "./bottom-nav";

export async function StudentBottomNav() {
  const session = await getSession();
  if (!session) return null;
  const profile = await getProfileByAppwriteId(session.userId);
  if (profile?.role !== "student") return null;
  return <BottomNav />;
}
