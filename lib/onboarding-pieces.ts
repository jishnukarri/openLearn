// Pure registry + helpers for the "Getting started" checklist. Students only.

export type OnboardingPiece = {
  key: string;
  title: string;
  description: string;
  href: string;
  minutes: number;
};

export const ONBOARDING_PIECES: readonly OnboardingPiece[] = [
  {
    key: "how-lessons-work",
    title: "How lessons work",
    description: "Try a tiny lesson and see what each part does.",
    href: "/onboarding/guide/how-lessons-work",
    minutes: 2,
  },
  {
    key: "how-practice-works",
    title: "How practice works",
    description: "See how exam questions and marks work.",
    href: "/onboarding/guide/how-practice-works",
    minutes: 1,
  },
  {
    key: "how-xp-works",
    title: "How XP and streaks work",
    description: "XP, streaks and mastery on one screen.",
    href: "/onboarding/guide/how-xp-works",
    minutes: 1,
  },
];

export function getPiece(key: string): OnboardingPiece | undefined {
  return ONBOARDING_PIECES.find((p) => p.key === key);
}

export function isPieceKey(key: string): boolean {
  return getPiece(key) !== undefined;
}

export function nextIncompletePiece(
  completed: ReadonlySet<string>,
  pieces: readonly OnboardingPiece[] = ONBOARDING_PIECES
): OnboardingPiece | null {
  return pieces.find((p) => !completed.has(p.key)) ?? null;
}

export function completedCount(
  completed: ReadonlySet<string>,
  pieces: readonly OnboardingPiece[] = ONBOARDING_PIECES
): number {
  return pieces.filter((p) => completed.has(p.key)).length;
}

export function allComplete(
  completed: ReadonlySet<string>,
  pieces: readonly OnboardingPiece[] = ONBOARDING_PIECES
): boolean {
  return completedCount(completed, pieces) === pieces.length;
}

// Show the checklist only when the table is reachable and something is left.
export function shouldShowChecklist(
  completed: ReadonlySet<string>,
  available: boolean,
  pieces: readonly OnboardingPiece[] = ONBOARDING_PIECES
): boolean {
  return available && !allComplete(completed, pieces);
}
