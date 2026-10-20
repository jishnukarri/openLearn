"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import { createServerUsers } from "@/lib/appwrite/server";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/supabase/database-client";
import { MUST_CHANGE_PASSWORD_PREF } from "@/lib/password-policy";
import { logAdminAction } from "@/lib/supabase/admin-audit";

export type SupportResult =
  | { ok: true; message: string; tempPassword?: string }
  | { ok: false; error: string };

// No 0/O, 1/l/I so it can be read out over the phone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 12): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

async function prepare(
  profileId: string,
  reason: string,
  action: string
): Promise<
  | { ok: false; error: string }
  | { ok: true; adminId: string; appwriteUserId: string; reason: string }
> {
  const { profile: admin } = await requireRole("admin");
  if (!profileId) return { ok: false, error: "Missing account." };
  if (profileId === admin.id) {
    return { ok: false, error: "You can't do this to your own account." };
  }
  const trimmed = (reason ?? "").trim();
  if (!trimmed) return { ok: false, error: "Add a reason so the action can be recorded." };
  if (trimmed.length > 500) return { ok: false, error: "Keep the reason under 500 characters." };

  const allowed = await checkKeyRateLimit(`admin-support:${action}`, admin.id, 10, 10 * 60_000);
  if (!allowed) return { ok: false, error: "Too many support actions. Wait a few minutes and try again." };

  const { data, error } = await db
    .from("profiles")
    .select("appwrite_user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "That account no longer exists." };
  return { ok: true, adminId: admin.id, appwriteUserId: data.appwrite_user_id, reason: trimmed };
}

async function audit(adminId: string, targetId: string, action: string, reason: string) {
  try {
    await logAdminAction({ adminId, targetId, action, reason });
  } catch {
    console.warn("admin_audit_log unavailable; support action was not recorded.");
  }
  revalidatePath(`/admin/users/${targetId}`);
}

async function run(
  profileId: string,
  reason: string,
  action: string,
  work: (appwriteUserId: string) => Promise<Partial<SupportResult & { ok: true }>>,
  fallbackMessage: string
): Promise<SupportResult> {
  const p = await prepare(profileId, reason, action);
  if (!p.ok) return p;
  try {
    const extra = await work(p.appwriteUserId);
    await audit(p.adminId, profileId, action, p.reason);
    return { ok: true, message: extra.message ?? fallbackMessage, tempPassword: extra.tempPassword };
  } catch {
    return { ok: false, error: "The account service rejected that request. Nothing was changed." };
  }
}

export async function resetPassword(profileId: string, reason: string): Promise<SupportResult> {
  const tempPassword = generateTempPassword();
  return run(
    profileId,
    reason,
    "reset_password",
    async (id) => {
      const users = createServerUsers();
      await users.updatePassword({ userId: id, password: tempPassword });
      const prefs = await users.getPrefs(id);
      await users.updatePrefs(id, { ...prefs, [MUST_CHANGE_PASSWORD_PREF]: true });
      await users.deleteSessions({ userId: id });
      return { tempPassword };
    },
    "Password reset and all sessions signed out. The student must choose a new password at next login."
  );
}

export async function signOutEverywhere(profileId: string, reason: string): Promise<SupportResult> {
  return run(
    profileId,
    reason,
    "sign_out_everywhere",
    async (id) => {
      await createServerUsers().deleteSessions({ userId: id });
      return {};
    },
    "Signed out of every device."
  );
}

export async function setAccountBlocked(
  profileId: string,
  block: boolean,
  reason: string
): Promise<SupportResult> {
  return run(
    profileId,
    reason,
    block ? "block_account" : "unblock_account",
    async (id) => {
      const users = createServerUsers();
      await users.updateStatus({ userId: id, status: !block });
      if (block) await users.deleteSessions({ userId: id });
      return {};
    },
    block ? "Account blocked and signed out." : "Account unblocked."
  );
}

export async function markEmailVerified(profileId: string, reason: string): Promise<SupportResult> {
  return run(
    profileId,
    reason,
    "mark_email_verified",
    async (id) => {
      await createServerUsers().updateEmailVerification({ userId: id, emailVerification: true });
      return {};
    },
    "Email marked as verified."
  );
}
