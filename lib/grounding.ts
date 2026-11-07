import type { LessonContent } from "@/lib/ai/lessons";

// What a lesson taught, boiled down for the generators that come after it
// (flashcards, exam questions): one entry per section, no check answers.
export type KeyPoint = { heading: string; explanation: string };

const MAX_POINT_CHARS = 260;
const MAX_POINTS = 8;

const firstSentences = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return end > 60 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
};

export function keyPointsFromLesson(lesson: Pick<LessonContent, "sections"> | null | undefined): KeyPoint[] {
  return (lesson?.sections ?? [])
    .filter((s) => s?.heading && s?.explanation)
    .slice(0, MAX_POINTS)
    .map((s) => ({ heading: s.heading.trim(), explanation: firstSentences(s.explanation, MAX_POINT_CHARS) }));
}

// The block that goes into a flashcard or exam-question prompt. Empty when
// there is nothing to ground on, so the prompt is then unchanged.
export function renderGrounding(input: { specExcerpt?: string | null; keyPoints?: KeyPoint[] | null }): string {
  const parts: string[] = [];
  const points = input.keyPoints ?? [];
  if (points.length) {
    parts.push(
      `WHAT THE STUDENT HAS JUST LEARNED in the lesson on this. Base your answer on these ` +
        `key points, so it tests exactly what was taught and nothing the lesson never covered:\n` +
        points.map((p) => `- ${p.heading}: ${p.explanation}`).join("\n")
    );
  }
  const spec = input.specExcerpt?.trim();
  if (spec) {
    parts.push(
      `OFFICIAL SPECIFICATION WORDING for this part of the course. Use its exact terms and ` +
        `stay within what it requires:\n${spec}`
    );
  }
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}
