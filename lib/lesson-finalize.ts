import "server-only";
import type { LessonContent, LessonInteractive, LessonVisual } from "@/lib/ai/lessons";
import { parseScene } from "@/lib/lesson-scene";
import { sanitizeVisual } from "@/lib/lesson-visual";
import { generateLessonImage } from "@/lib/ai/images";
import { generateScenesForLesson } from "@/lib/ai/scenes";
import { deepCollapseRepeatedChars } from "@/lib/text-sanitize";

// Runs between AI generation and createLesson(): sanitizes every visual
// (structure only — the site owns styling), collapses runaway repeated
// characters (a known generation failure mode — an emoji/variation
// selector repeated thousands of times instead of normal text), drops a
// pre-lesson interactive that generated with no actual content (e.g. a
// slider_sim with zero sliders — the player would otherwise show an
// empty, unusable widget forever), and generates+stores any images. A
// visual that sanitizes to nothing, or an image that can't be generated,
// is dropped rather than failing the lesson.
export async function finalizeLessonContent(
  rawContent: LessonContent,
  topicId: string,
  subjectName?: string
): Promise<LessonContent> {
  const content = deepCollapseRepeatedChars(rawContent);
  const sections = await Promise.all(
    (content.sections ?? []).filter((section) => section && section.check).map(async (section) => ({
      ...section,
      visual: await finalizeVisual(section.visual, topicId, section.heading),
      exampleVisual: await finalizeVisual(section.exampleVisual, topicId, section.heading),
      exampleScene: parseScene(section.exampleScene),
      exampleSteps: cleanSteps(section.exampleSteps),
    }))
  );
  const result: LessonContent = {
    ...content,
    sections,
    interactive: sanitizeInteractive(content.interactive),
  };
  // Scenes come from a separate cheap model (lib/ai/scenes.ts); never throws,
  // and with no key / on failure the content is returned unchanged.
  if (!subjectName) return result;
  try {
    return await generateScenesForLesson(result, subjectName);
  } catch {
    return result;
  }
}

// Re-sanitizes stored visuals (and drops an invalid interactive) at read
// time — defense in depth, also covers lessons saved before this check
// existed. No image generation.
export function resanitizeLessonContent(rawContent: LessonContent): LessonContent {
  const content = deepCollapseRepeatedChars(rawContent);
  return {
    ...content,
    // A section with no check can't be played (the plan and player both read
    // section.check), so a malformed stored section is dropped, not rendered.
    sections: (content.sections ?? []).filter((section) => section && section.check).map((section) => ({
      ...section,
      visual: sanitizeVisual(section.visual, section.heading),
      exampleVisual: sanitizeVisual(section.exampleVisual, section.heading),
      exampleScene: parseScene(section.exampleScene),
      exampleSteps: cleanSteps(section.exampleSteps),
    })),
    interactive: sanitizeInteractive(content.interactive),
  };
}

// Each interactive kind needs at least the content its widget actually
// renders — an empty array here means the AI generated a shell with
// nothing inside it, which the player can't recover from, so drop the
// whole interactive (the lesson just opens straight into the hook/first
// section instead of showing a broken widget).
function sanitizeInteractive(
  interactive: LessonInteractive | undefined | null
): LessonInteractive | null {
  if (!interactive) return null;
  switch (interactive.kind) {
    case "slider_sim":
      return interactive.sliders?.length && interactive.outcomes?.length ? interactive : null;
    case "branching":
      return interactive.choices?.length ? interactive : null;
    case "graph":
      return interactive.params?.length ? interactive : null;
    case "block_sort":
      return interactive.blocks?.length && interactive.correctOrder?.length ? interactive : null;
    case "flowchart":
      return interactive.steps?.length && interactive.correctOrder?.length ? interactive : null;
    case "categorize":
      return interactive.categories?.length && interactive.items?.length ? interactive : null;
    default:
      return null;
  }
}

function cleanSteps(steps: string[] | undefined | null): string[] | undefined {
  const out = (Array.isArray(steps) ? steps : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);
  return out.length ? out : undefined;
}

async function finalizeVisual(
  visual: LessonVisual | undefined | null,
  topicId: string,
  fallbackAlt = ""
): Promise<LessonVisual | null> {
  const cleaned = sanitizeVisual(visual, fallbackAlt);
  if (!cleaned) return null;
  if (cleaned.kind !== "image") return cleaned;

  const url =
    cleaned.url ??
    (await generateLessonImage(cleaned.prompt, topicId)) ??
    undefined;
  if (!url) {
    // Kept (prompt + alt, no url) so the failure is visible in stored data;
    // the player falls back to the animated step frame for it.
    console.error("Lesson image not generated; saved without url:", cleaned.alt);
  }
  return { ...cleaned, url };
}
