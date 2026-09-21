"use server";

import * as z from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, SESSION_COOKIE } from "@/lib/appwrite/session";
import { createServerUsers, createSessionClient } from "@/lib/appwrite/server";
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
