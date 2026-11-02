// Pure helpers for saving a teacher-edited lesson.
import type { LessonContent, LessonSection } from "@/lib/ai/lessons";
import { deriveExampleSteps } from "./worked-example";

const norm = (s: unknown) => (typeof s === "string" ? s.trim() : "");

// True when the text behind a section's animation has changed.
export function exampleChanged(stored: LessonSection | undefined, next: LessonSection): boolean {
  if (!stored) return false;
  return (
    norm(stored.example) !== norm(next.example) ||
    norm(stored.heading) !== norm(next.heading) ||
    norm(stored.explanation) !== norm(next.explanation)
  );
}

// Clears the stale scene + steps on edited sections and re-derives steps from
// the new example text. Returns the new content and which sections changed.
export function refreshStaleExamples(
  stored: LessonContent | null,
  next: LessonContent
): { content: LessonContent; changed: number[] } {
  const changed: number[] = [];
  const sections = next.sections.map((section, i) => {
    if (!exampleChanged(stored?.sections?.[i], section)) return section;
    changed.push(i);
    return {
      ...section,
      exampleScene: null,
      exampleSteps: deriveExampleSteps(section.example),
      // The recording reads the old wording; drop it rather than teach stale text.
      narration: null,
      audioId: null,
      audioStarts: null,
    };
  });
  return { content: { ...next, sections }, changed };
}
