import type { LessonVisual as Visual } from "@/lib/ai/lessons";

// Renders a sanitized lesson visual. Markup here was cleaned server-side by
// lib/lesson-finalize.ts before storage and re-sanitized on load in the
// lesson page, so it contains only allowlisted structural tags, all
// styling comes from the .lesson-embed rules in globals.css.
export function LessonVisual({ visual }: { visual: Visual | null | undefined }) {
  if (!visual) return null;
  if (visual.kind === "svg") {
    return (
      <figure className="lesson-embed">
        <div dangerouslySetInnerHTML={{ __html: visual.svg }} />
        {visual.caption && (
          <figcaption className="lesson-embed-caption">
            {visual.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (visual.kind === "html") {
    return (
      <div
        className="lesson-embed"
        dangerouslySetInnerHTML={{ __html: visual.html }}
      />
    );
  }
  if (visual.kind === "image" && visual.url) {
    return (
      <figure className="lesson-embed">
        {/* eslint-disable-next-line @next/next/no-img-element -- AI-generated image with unknown dimensions */}
        <img src={visual.url} alt={visual.alt} />
      </figure>
    );
  }
  return null;
}
