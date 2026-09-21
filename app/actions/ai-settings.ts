"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import {
  saveTeacherAiSettings,
  deleteTeacherAiSettings,
  getTeacherAiSettings,
} from "@/lib/supabase/ai-settings";

const SettingsSchema = z.object({
  provider: z.enum(["ollama", "openrouter", "hackclub", "gemini"]),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().optional(),
  host: z.string().trim().optional(),
});

export async function saveTeacherAiSettingsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");

  const validated = SettingsSchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey") || undefined,
    model: formData.get("model") || undefined,
    host: formData.get("host") || undefined,
  });
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message ?? "Invalid input.");
  }

  // Leaving the key field blank keeps whatever was already saved — it's
  // never redisplayed in the form, so re-typing it every time you just want
  // to change the model would be pure friction.
  let apiKey = validated.data.apiKey;
  if (!apiKey) {
    const existing = await getTeacherAiSettings(profile.id);
    apiKey = existing?.apiKey;
  }
  if (!apiKey) throw new Error("API key is required.");

  await saveTeacherAiSettings(profile.id, { ...validated.data, apiKey });
  revalidatePath("/teacher/settings");
}

export async function deleteTeacherAiSettingsAction(): Promise<void> {
  const { profile } = await requireRole("teacher");
  await deleteTeacherAiSettings(profile.id);
  revalidatePath("/teacher/settings");
}
