import type { LessonCheck, LessonSection } from "@/lib/ai/lessons";

// ── Types ──────────────────────────────────────────────────────────────────
export type Step =
  | { phase: "interactive" }
  | { phase: "hook" }
  | { phase: "teach"; sectionIndex: number }
  | { phase: "check"; sectionIndex: number }
  | { phase: "flashcard"; cardIndices: number[] }
  | { phase: "tutor"; sectionIndex: number }
  | { phase: "recap" }
  | { phase: "done" };

// Only a "short" check is phrased as a genuinely open-ended question — its
// text stands alone as a prompt. "matching" reads like "Match X with Y" and
// "mcq"/"multi" read like "Which of these…", both assuming visible options
// that never get shown in this free-text format, so reusing their question
// text here reads as broken/nonsensical rather than as an essay prompt.
export function isTutorFriendly(sec: LessonSection): boolean {
  return sec.check.kind === "short";
}

// Picks the best section index for a tutor step within a just-finished
// group of (up to) two sections, preferring the later one but falling
// back to the earlier one, or null if neither works as an essay prompt.
export function pickTutorIndex(sections: LessonSection[], i: number): number | null {
  if (isTutorFriendly(sections[i])) return i;
  if (i > 0 && isTutorFriendly(sections[i - 1])) return i - 1;
  return null;
}

// ── Lesson plan builder ────────────────────────────────────────────────────
// Sequence: teach → check → (flashcard every even group) → (tutor every odd group) → recap
export function buildLessonPlan(
  hasInteractive: boolean,
  hasHook: boolean,
  sections: LessonSection[]
): Step[] {
  const plan: Step[] = [];
  if (hasInteractive) plan.push({ phase: "interactive" });
  if (hasHook) plan.push({ phase: "hook" });

  const N = sections.length;
  let lastWasTutor = false;

  for (let i = 0; i < N; i++) {
    plan.push({ phase: "teach", sectionIndex: i });
    plan.push({ phase: "check", sectionIndex: i });

    if (i < N - 1) {
      const isGroupEnd = (i + 1) % 2 === 0;
      const groupNum = Math.floor(i / 2);
      if (isGroupEnd) {
        if (groupNum % 2 === 0) {
          plan.push({ phase: "flashcard", cardIndices: [i - 1, i] });
          lastWasTutor = false;
        } else {
          const tutorIndex = pickTutorIndex(sections, i);
          if (tutorIndex !== null) {
            plan.push({ phase: "tutor", sectionIndex: tutorIndex });
            lastWasTutor = true;
          } else {
            plan.push({ phase: "flashcard", cardIndices: [i - 1, i] });
            lastWasTutor = false;
          }
        }
      } else {
        lastWasTutor = false;
      }
    }
  }

  if (N > 0 && !lastWasTutor) {
    const finalTutorIndex = pickTutorIndex(sections, N - 1);
    if (finalTutorIndex !== null) {
      plan.push({ phase: "tutor", sectionIndex: finalTutorIndex });
    }
  }
  plan.push({ phase: "recap" });
  return plan;
}

// ── Helpers ────────────────────────────────────────────────────────────────
export function getCorrectAnswerLabel(check: LessonCheck): string {
  switch (check.kind) {
    case "multi":
      return check.correctIndexes.map((i) => check.options[i]).join(", ");
    case "short":
      return check.accepted[0] ?? "";
    case "matching":
      return "";
    default:
      return check.options[check.correctIndex] ?? "";
  }
}

export function cardDefinition(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  if (match && match[0].length < 160) return match[0];
  return text.slice(0, 130) + (text.length > 130 ? "…" : "");
}

