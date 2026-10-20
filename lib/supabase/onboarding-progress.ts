import "server-only";
import { db } from "./database-client";

export type OnboardingProgress = {
  completed: Set<string>;
  // False when the table doesn't exist yet (migration not applied); the UI
  // then hides the checklist instead of nagging forever.
  available: boolean;
};

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /onboarding_progress/.test(error.message ?? "") && /(does not exist|schema cache)/.test(error.message ?? "")
  );
}

export async function getCompletedPieces(profileId: string): Promise<OnboardingProgress> {
  try {
    const { data, error } = await db
      .from("onboarding_progress")
      .select("piece")
      .eq("profile_id", profileId);
    if (error) {
      if (isMissingTable(error)) {
        console.warn("onboarding_progress table is missing; skipping checklist.");
        return { completed: new Set(), available: false };
      }
      throw error;
    }
    return { completed: new Set((data as { piece: string }[]).map((r) => r.piece)), available: true };
  } catch (err) {
    console.warn("Could not load onboarding progress:", err);
    return { completed: new Set(), available: false };
  }
}

export async function markPieceComplete(profileId: string, piece: string): Promise<void> {
  const { error } = await db
    .from("onboarding_progress")
    .upsert({ profile_id: profileId, piece }, { onConflict: "profile_id,piece", ignoreDuplicates: true });
  if (error) throw error;
}
