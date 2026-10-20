import type { LessonVisual } from "@/lib/ai/lessons";
import { sanitizeLessonHtml, sanitizeLessonSvg } from "./lesson-sanitize";

// Pure: cleans one stored visual. A teacher-uploaded image (url, no prompt)
// with no alt text is kept with `fallbackAlt` (the section heading) instead of
// being silently dropped.
export function sanitizeVisual(
  visual: LessonVisual | undefined | null,
  fallbackAlt = ""
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
    case "image": {
      const alt = (visual.alt ?? "").trim() || fallbackAlt.trim();
      const url = typeof visual.url === "string" ? visual.url.trim() : "";
      if (url) {
        if (!/^(https?:\/\/|\/)/i.test(url) || !alt) return null;
        return { ...visual, url, alt, prompt: visual.prompt ?? "" };
      }
      return visual.prompt && alt ? { ...visual, alt } : null;
    }
    default:
      return null;
  }
}
