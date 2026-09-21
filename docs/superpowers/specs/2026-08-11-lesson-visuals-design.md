# Lesson Visuals: AI images & custom HTML embeds

**Date:** 2026-08-11
**Status:** Approved in discussion, pending spec review

## Goal

Let the lesson-generation AI optionally add a visual to each lesson section —
an inline SVG diagram, a sanitized HTML embed, or a generated image — while
guaranteeing every visual renders in the site's own design system. The AI
supplies **structure only, never styling**: no `style` attributes, no `class`
attributes, no CSS of any kind. All appearance comes from the app's CSS.

## Non-goals

- Web-searched / recalled image URLs (unreliable without a search API; the
  generated-image path covers "real picture" needs).
- Interactive JS widgets or iframes.
- Visuals in practice questions, diagnostics, or marking — lessons only.

## Schema change (`lib/ai/lessons.ts`)

`LessonSection` gains an optional `visual`:

```ts
export type LessonVisual =
  | { kind: "svg"; svg: string; caption?: string }
  | { kind: "html"; html: string }
  | { kind: "image"; prompt: string; alt: string; url?: string };

export type LessonSection = {
  heading: string;
  explanation: string;
  example: string;
  visual?: LessonVisual;   // omitted when no visual helps
  check: LessonCheck;
};
```

The JSON schema passed to `chatJson` encodes `visual` as a nullable object
with a `kind` discriminator (object-rooted, per the Ollama structured-output
rule in `lib/ai/client.ts`). Old lessons stored without `visual` remain valid
— the field is optional end-to-end, so no migration is needed.

## Source priority

The generation prompt instructs the model, per section:

1. **No visual** unless it genuinely teaches the idea.
2. **`svg`** when the idea is diagrammable (graphs, cycles, forces, labelled
   structures). Drawn inline; colors only via `currentColor`, `none`, or
   `var(--color-*)` theme tokens.
3. **`html`** for structural content: tables, comparison grids, labelled
   figures, step callouts. Bare semantic HTML only.
4. **`image`** when only a realistic picture works (scenes, textures,
   photos-of-things). The model writes a generation `prompt` + `alt`; it never
   writes a URL.

## Image generation (nano banana)

At pregeneration time (`lib/content-pipeline.ts`) and after `tweakLesson`,
a post-processing step scans the lesson for `image` visuals with no `url`:

- If `GEMINI_API_KEY` is configured, call `gemini-2.5-flash-image` with the
  prompt (prefixed with a house-style line: clean, flat, friendly educational
  illustration, no embedded text), upload the PNG to a public Supabase storage
  bucket `lesson-images` (path `lessons/<topicId>/<hash>.png`), and write the
  public URL into the visual's `url` before the lesson is saved.
- If no key or generation fails, the visual is left without `url`; the player
  simply skips rendering it. Lessons never fail or block on image generation.

New module: `lib/ai/images.ts` exporting
`generateLessonImage(prompt: string): Promise<string | null>` (returns the
stored public URL or null). Called only from server code.

## Sanitization (`lib/lesson-sanitize.ts`)

One sanitizer (npm `sanitize-html`), applied **at generation time before
saving** and again **at render time** (defense in depth, and it covers
lessons saved before a future allowlist tightening).

- **HTML allowlist:** `p, ul, ol, li, table, thead, tbody, tr, th, td,
  strong, em, code, pre, blockquote, figure, figcaption, br, sub, sup, h4`.
- **SVG allowlist:** `svg, g, path, line, polyline, polygon, rect, circle,
  ellipse, text, tspan, defs, marker, title`.
- **Attributes:** structural only (`svg`: `viewBox`, `width`, `height`,
  geometry attributes like `d/x/y/r/cx/cy/points/x1..y2`, `text-anchor`,
  `font-size`, `stroke-width`, `marker-end`). `style` and `class` are always
  stripped, everywhere. No event handlers, no `href`/`xlink:href`, no
  `script/iframe/foreignObject/object/embed/img` inside embeds.
- **Color rule:** `fill` and `stroke` allowed only when the value matches
  `^(currentColor|none|var\(--color-[a-z-]+\))$`; otherwise the attribute is
  dropped (element kept). This is the single exception to "no presentation
  attributes" because SVG is invisible without fill/stroke.

## Rendering

New client component `app/learn/[topicId]/lesson-visual.tsx`:

- `svg` / `html`: render sanitized markup via `dangerouslySetInnerHTML`
  inside `<div className="lesson-embed">` (plus `<figcaption>` for SVG
  captions).
- `image`: render only if `url` is set — `next/image`-free plain `<img>` with
  `alt`, rounded corners, `max-width: 100%`, inside the same wrapper.

`LessonPlayer` renders the visual between the explanation and the example.

**`lesson-embed` styles** (added to `app/globals.css`, using existing theme
tokens only): typography, spacing, bordered rounded tables with `--color-surface`
header rows, `--color-border` rules, blockquote as a subtle callout, code in
the mono font, SVGs centered with `max-width: 100%; height: auto` and
`color: var(--color-foreground)` so `currentColor` resolves to the site
foreground in both themes.

## Prompt changes

`generateLesson` and `tweakLesson` gain a shared style-guide snippet stating:
the visual field is optional; the source-priority rules above; the exact tag
allowlist; "never write style or class attributes — styling is applied by the
site"; SVG color rule with the list of real token names (from
`app/globals.css`); `viewBox` required, no fixed pixel width.

## Error handling

- Sanitizer output empty after cleaning → treat as no visual.
- Image generation error → log, continue without image (never throw from the
  pipeline).
- Unknown `kind` at render time → skip.

## Testing

- Unit tests for `lib/lesson-sanitize.ts`: script/event-handler/iframe
  stripping, style/class stripping, color-rule enforcement, allowed markup
  passes through unchanged.
- Manual: regenerate a lesson on a visual-friendly topic (e.g. "The water
  cycle") and verify SVG renders themed in light and dark; verify a lesson
  without visuals still plays; with a Gemini key, verify an image generates
  and stores.
