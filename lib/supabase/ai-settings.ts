import "server-only";
import { createServiceClient } from "./server";
import type { Provider, ProviderConfig } from "@/lib/ai/client";

export async function getTeacherAiSettings(
  profileId: string
): Promise<ProviderConfig | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("teacher_ai_settings")
    .select("provider, api_key, model, host")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    provider: data.provider,
    apiKey: data.api_key,
    model: data.model ?? undefined,
    host: data.host ?? undefined,
  };
}

export async function saveTeacherAiSettings(
  profileId: string,
  config: { provider: Provider; apiKey: string; model?: string; host?: string }
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("teacher_ai_settings").upsert({
    profile_id: profileId,
    provider: config.provider,
    api_key: config.apiKey,
    model: config.model || null,
    host: config.host || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteTeacherAiSettings(profileId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("teacher_ai_settings")
    .delete()
    .eq("profile_id", profileId);
  if (error) throw error;
}
