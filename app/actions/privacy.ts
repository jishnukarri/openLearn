"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId, setPrivacyAck } from "@/lib/supabase/profiles";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { roleHome } from "@/lib/roles";

// Uses getSession, not requireRole: this is the page the privacy gate sends people to.
export async function acceptPrivacyAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await getProfileByAppwriteId(session.userId);
  if (!profile) redirect("/login");
  await setPrivacyAck(profile.id, PRIVACY_VERSION);
  redirect(roleHome(profile.role));
}
