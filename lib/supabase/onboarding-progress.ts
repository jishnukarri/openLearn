import "server-only";
import { db } from "./database-client";
import { isMissingTableError } from "@/lib/onboarding-pieces";

export type OnboardingProgress = {
  completed: Set<string>;
  // False when the table doesn't exist yet (migration not applied); the UI
  // then hides the checklist instead of nagging forever.
  available: boolean;
};

export async function getCompletedPieces(profileId: string): Promise<OnboardingProgress> {
  try {
    const { data, error } = await db
      .from("onboarding_progress")
      .select("piece")
      .eq("profile_id", profileId);
    if (error) {
      if (isMissingTableError(error)) {
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
  if (error) {
    // Without the table the checklist is hidden anyway; finishing a tour
    // must not crash on it.
    if (isMissingTableError(error)) {
      console.warn("onboarding_progress table is missing; completion not saved.");
      return;
    }
    throw error;
  }
}
