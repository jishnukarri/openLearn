import "server-only";
import type { LessonContent, LessonInteractive, LessonVisual } from "@/lib/ai/lessons";
import { parseScene } from "@/lib/lesson-scene";
import { sanitizeLessonHtml, sanitizeLessonSvg } from "@/lib/lesson-sanitize";
import { generateLessonImage } from "@/lib/ai/images";
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
  topicId: string
): Promise<LessonContent> {
  const content = deepCollapseRepeatedChars(rawContent);
  const sections = await Promise.all(
    (content.sections ?? []).map(async (section) => ({
      ...section,
      visual: await finalizeVisual(section.visual, topicId),
      exampleVisual: await finalizeVisual(section.exampleVisual, topicId),
      exampleScene: parseScene(section.exampleScene),
      exampleSteps: cleanSteps(section.exampleSteps),
    }))
  );
  return {
    ...content,
    sections,
    interactive: sanitizeInteractive(content.interactive),
  };
}

// Re-sanitizes stored visuals (and drops an invalid interactive) at read
// time — defense in depth, also covers lessons saved before this check
// existed. No image generation.
export function resanitizeLessonContent(rawContent: LessonContent): LessonContent {
  const content = deepCollapseRepeatedChars(rawContent);
  return {
    ...content,
    sections: (content.sections ?? []).map((section) => ({
      ...section,
      visual: sanitizeVisual(section.visual),
      exampleVisual: sanitizeVisual(section.exampleVisual),
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

function sanitizeVisual(
  visual: LessonVisual | undefined | null
): LessonVisual | null {
  if (!visual) return null;
  switch (visual.kind) {
    case "svg": {
      const svg = sanitizeLessonSvg(visual.svg ?? "");
      return svg ? { kind: "svg", svg, caption: visual.caption } : null;
    }
    case "html": {
      const html = sanitizeLessonHtml(visual.html ?? "");
      return html ? { kind: "html", html } : null;
    }
    case "image":
      // Accept teacher-uploaded images (url set, prompt empty) and AI images (prompt+alt set).
      return (visual.url && visual.alt) || (visual.prompt && visual.alt) ? visual : null;
    default:
      return null;
  }
}

async function finalizeVisual(
  visual: LessonVisual | undefined | null,
  topicId: string
): Promise<LessonVisual | null> {
  const cleaned = sanitizeVisual(visual);
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
