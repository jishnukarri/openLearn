"use server";

import * as z from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, requireSession, SESSION_COOKIE } from "@/lib/appwrite/session";
import { createServerUsers, createSessionClient } from "@/lib/appwrite/server";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { MUST_CHANGE_PASSWORD_PREF, validateNewPassword } from "@/lib/password-policy";
import { roleHome } from "@/lib/roles";
import { getBlockMatch } from "@/lib/supabase/blocklist";
import { getProfileByAppwriteId, updateProfileName, deleteProfile } from "@/lib/supabase/profiles";

export type AccountFormState = { message?: string } | undefined;

const NameSchema = z.string().min(2, "Name must be at least 2 characters.").trim();

export async function updateNameAction(
  _state: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireSession();
  const profile = await getProfileByAppwriteId(session.userId);
  if (!profile) return { message: "Profile not found." };

  const validated = NameSchema.safeParse(formData.get("fullName"));
  if (!validated.success) {
    return { message: validated.error.issues[0]?.message ?? "Invalid name." };
  }

  if (await getBlockMatch("name", validated.data)) {
    return {
      message:
        "This email or name can't be used. Contact your administrator if you think this is a mistake.",
    };
  }

  await updateProfileName(profile.id, validated.data);
  revalidatePath("/account");
  return { message: "Saved." };
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const confirmation = formData.get("confirmation");
  if (confirmation !== "DELETE") {
    throw new Error('Type "DELETE" to confirm.');
  }

  const profile = await getProfileByAppwriteId(session.userId);
  if (profile) await deleteProfile(profile.id);

  const cookieStore = await cookies();
  const secret = cookieStore.get(SESSION_COOKIE)?.value;
  if (secret) {
    try {
      await createSessionClient(secret).deleteSession("current");
    } catch {
      // ignore — deleting the user below invalidates it anyway
    }
  }

  try {
    await createServerUsers().delete(session.userId);
  } catch {
    // Appwrite user delete failed (already gone?) — profile is gone either
    // way, so continue clearing the local session rather than blocking.
  }

  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}

export type PasswordFormState =
  | {
      errors?: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
      message?: string;
      success?: boolean;
    }
  | undefined;

// Deliberately uses getSession, not requireSession: a flagged account must be
// able to reach this action. Passwords are never logged.
export async function changePasswordAction(
  _state: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current) return { errors: { currentPassword: "Enter your current password." } };
  const problem = validateNewPassword(current, next, confirm);
  if (problem) {
    const field = next.length >= 8 && next !== current ? "confirmPassword" : "newPassword";
    return { errors: { [field]: problem } };
  }

  if (!(await checkKeyRateLimit("change-password", session.userId, 5, 10 * 60_000))) {
    return { message: "Too many attempts. Please try again in a few minutes." };
  }

  const cookieStore = await cookies();
  const secret = cookieStore.get(SESSION_COOKIE)?.value;
  if (!secret) redirect("/login");

  try {
    await createSessionClient(secret).updatePassword(next, current);
  } catch {
    return { errors: { currentPassword: "That isn't your current password." } };
  }

  try {
    const users = createServerUsers();
    const prefs = (await users.getPrefs(session.userId)) as Record<string, unknown>;
    if (prefs[MUST_CHANGE_PASSWORD_PREF] === true) {
      await users.updatePrefs(session.userId, { ...prefs, [MUST_CHANGE_PASSWORD_PREF]: false });
    }
  } catch {
    return {
      message:
        "Your password was changed, but we couldn't finish updating your account. Log out and back in, or try again.",
    };
  }

  if (session.mustChangePassword) {
    const profile = await getProfileByAppwriteId(session.userId);
    redirect(roleHome(profile?.role));
  }
  return { success: true, message: "Password changed. You stay signed in on this device." };
}
