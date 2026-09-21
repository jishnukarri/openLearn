# Lesson Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the lesson AI optionally attach an SVG diagram, sanitized HTML embed, or nano-banana-generated image to each lesson section, always rendered in the site's own design system.

**Architecture:** Extend the `LessonSection` JSON schema with an optional `visual` discriminated union. A `finalizeLessonContent()` step sanitizes all visual markup (stripping every `style`/`class`; SVG colors restricted to theme tokens) and generates+stores any images before the lesson is saved. The player renders visuals through a new `LessonVisual` component styled by a `lesson-embed` block in globals.css.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind v4 tokens in globals.css, sanitize-html, @google/genai (`gemini-2.5-flash-image`), Supabase storage, vitest.

## Global Constraints

- AI-authored markup carries **no styling**: `style` and `class` attributes always stripped.
- SVG `fill`/`stroke` values must match `^(currentColor|none|var\(--color-[a-z-]+\))$` or the attribute is dropped.
- Theme tokens available: `--color-background, --color-surface, --color-border, --color-foreground, --color-muted, --color-primary, --color-secondary, --color-highlight, --color-success, --color-error`.
- Ollama structured-output rule: every chatJson schema is object-rooted (see lib/ai/client.ts).
- Image generation must never fail the lesson pipeline — errors log and continue.
- `visual` is optional end-to-end; lessons saved before this feature keep working.
- Project is not a git repo — skip all commit steps.

---

### Task 1: Sanitizer (`lib/lesson-sanitize.ts`)

**Files:**
- Create: `lib/lesson-sanitize.ts`
- Test: `lib/lesson-sanitize.test.ts`
- Modify: `package.json` (deps + test script)

**Interfaces:**
- Produces: `sanitizeLessonHtml(html: string): string`, `sanitizeLessonSvg(svg: string): string` — both return `""` when nothing safe remains.

- [ ] **Step 1: Install deps**

```bash
npm install sanitize-html && npm install -D @types/sanitize-html vitest
```

Add to package.json scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write failing tests** (`lib/lesson-sanitize.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { sanitizeLessonHtml, sanitizeLessonSvg } from "./lesson-sanitize";

describe("sanitizeLessonHtml", () => {
  it("keeps allowed structural markup", () => {
    const html = "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td><strong>1</strong></td></tr></tbody></table>";
    expect(sanitizeLessonHtml(html)).toBe(html);
  });
  it("strips scripts, iframes, imgs and event handlers", () => {
    expect(sanitizeLessonHtml('<p onclick="x()">hi<script>evil()</script><iframe src="x"></iframe><img src="x"></p>')).toBe("<p>hi</p>");
  });
  it("strips style and class attributes", () => {
    expect(sanitizeLessonHtml('<p style="color:red" class="x">hi</p>')).toBe("<p>hi</p>");
  });
  it("returns empty string when nothing safe remains", () => {
    expect(sanitizeLessonHtml('<script>x</script>')).toBe("");
  });
});

describe("sanitizeLessonSvg", () => {
  it("keeps themed svg", () => {
    const svg = '<svg viewBox="0 0 100 50"><circle cx="10" cy="10" r="5" fill="var(--color-primary)"></circle><text x="1" y="1">hi</text></svg>';
    expect(sanitizeLessonSvg(svg)).toBe(svg);
  });
  it("drops raw-color fills but keeps the element", () => {
    expect(sanitizeLessonSvg('<svg viewBox="0 0 1 1"><rect width="1" height="1" fill="#ff0000" stroke="currentColor"></rect></svg>'))
      .toBe('<svg viewBox="0 0 1 1"><rect width="1" height="1" stroke="currentColor"></rect></svg>');
  });
  it("strips script/foreignObject/handlers/style/class", () => {
    expect(sanitizeLessonSvg('<svg viewBox="0 0 1 1" onload="x()" class="a"><foreignObject>x</foreignObject><path d="M0 0" style="fill:red"></path></svg>'))
      .toBe('<svg viewBox="0 0 1 1"><path d="M0 0"></path></svg>');
  });
  it("returns empty string for non-svg input", () => {
    expect(sanitizeLessonSvg("<p>hi</p>")).toBe("");
  });
});
```

- [ ] **Step 3: Run `npx vitest run lib/lesson-sanitize.test.ts`** — expect FAIL (module missing).

- [ ] **Step 4: Implement** (`lib/lesson-sanitize.ts`)

```ts
import sanitizeHtml from "sanitize-html";

// AI-authored lesson visuals carry structure only — the site owns all
// styling, so style/class are never allowed and SVG colors must be theme
// tokens (enforced by THEME_COLOR below).
const THEME_COLOR = /^(currentColor|none|var\(--color-[a-z-]+\))$/;

const HTML_TAGS = ["p","ul","ol","li","table","thead","tbody","tr","th","td","strong","em","code","pre","blockquote","figure","figcaption","br","sub","sup","h4"];

const SVG_TAGS = ["svg","g","path","line","polyline","polygon","rect","circle","ellipse","text","tspan","defs","marker","title"];

const SVG_ATTRS = ["viewBox","width","height","d","x","y","x1","y1","x2","y2","cx","cy","r","rx","ry","points","transform","text-anchor","font-size","stroke-width","stroke-dasharray","stroke-linecap","stroke-linejoin","fill-opacity","stroke-opacity","opacity","marker-end","marker-start","id","refX","refY","markerWidth","markerHeight","orient"];

function clean(input: string, tags: string[], attrs: Record<string, string[]>): string {
  return sanitizeHtml(input, {
    allowedTags: tags,
    allowedAttributes: attrs,
    disallowedTagsMode: "discard",
    parser: { lowerCaseAttributeNames: false },
  }).trim();
}

export function sanitizeLessonHtml(html: string): string {
  const out = clean(html, HTML_TAGS, {});
  return sanitizeHtml(out, { allowedTags: [], allowedAttributes: {} }).trim() === "" && !/<(table|ul|ol|figure)/.test(out) ? "" : out;
}

export function sanitizeLessonSvg(svg: string): string {
  const out = clean(svg, SVG_TAGS, {
    "*": [...SVG_ATTRS, "fill", "stroke"],
  });
  if (!out.startsWith("<svg")) return "";
  // Enforce the theme-token color rule per attribute.
  return out.replace(/\s(fill|stroke)="([^"]*)"/g, (m, name, value) =>
    THEME_COLOR.test(value) ? m : ""
  );
}
```

Note for implementer: sanitize-html lowercases attribute names by default which breaks `viewBox`; `parser.lowerCaseAttributeNames: false` handles that. Adjust implementation until the tests in Step 2 pass exactly — tests are the contract, tweak implementation not tests.

- [ ] **Step 5: Run `npx vitest run`** — expect PASS. Fix implementation until green.

### Task 2: Schema + prompts (`lib/ai/lessons.ts`)

**Files:**
- Modify: `lib/ai/lessons.ts`

**Interfaces:**
- Produces: `LessonVisual` type; `LessonSection.visual?: LessonVisual`; SCHEMA updated; both `generateLesson` and `tweakLesson` prompt with the visual style guide.

- [ ] **Step 1: Add types**

```ts
export type LessonVisual =
  | { kind: "svg"; svg: string; caption?: string }
  | { kind: "html"; html: string }
  | { kind: "image"; prompt: string; alt: string; url?: string };
```

Add `visual?: LessonVisual` to `LessonSection`.

- [ ] **Step 2: Extend SCHEMA**

Inside the section item's `properties`, add (NOT in `required` — providers with strict schemas treat absent optional fields fine when not required; Gemini/Ollama tolerate this shape):

```ts
visual: {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["svg", "html", "image"] },
    svg: { type: "string" },
    html: { type: "string" },
    caption: { type: "string" },
    prompt: { type: "string" },
    alt: { type: "string" },
  },
  required: ["kind"],
},
```

- [ ] **Step 3: Add shared style-guide snippet and append to both prompts**

```ts
const VISUAL_GUIDE =
  `\n\nOptionally, a section may include a "visual" when (and only when) a ` +
  `picture genuinely teaches the idea better than words. Pick the first that fits:\n` +
  `1. kind "svg" — for diagrammable ideas (graphs, cycles, forces, labelled ` +
  `structures). Inline SVG with a viewBox (around 0 0 400 240), no fixed pixel ` +
  `width. Allowed tags: svg, g, path, line, polyline, polygon, rect, circle, ` +
  `ellipse, text, tspan, defs, marker, title. Colors ONLY via fill/stroke set to ` +
  `currentColor, none, or one of: var(--color-primary), var(--color-secondary), ` +
  `var(--color-highlight), var(--color-success), var(--color-error), ` +
  `var(--color-muted), var(--color-border), var(--color-surface).\n` +
  `2. kind "html" — for structural content (comparison tables, step lists, ` +
  `labelled figures). Allowed tags: p, ul, ol, li, table, thead, tbody, tr, th, ` +
  `td, strong, em, code, pre, blockquote, figure, figcaption, br, sub, sup, h4.\n` +
  `3. kind "image" — only when a realistic picture is essential. Write a ` +
  `"prompt" describing the image for an image generator plus an "alt" text. ` +
  `Never write a URL.\n` +
  `NEVER write style or class attributes anywhere — the site applies all ` +
  `styling. Most sections should have no visual at all.`;
```

Append `${VISUAL_GUIDE}` to the end of the `generateLesson` prompt string and to the `tweakLesson` prompt (after the instruction sentence).

- [ ] **Step 4: Run `npx tsc --noEmit`** — expect PASS (player untouched; optional field).

### Task 3: Image generation + finalize step

**Files:**
- Create: `lib/ai/images.ts`
- Create: `lib/lesson-finalize.ts`
- Modify: `lib/content-pipeline.ts`, `app/actions/lessons.ts`

**Interfaces:**
- Consumes: `sanitizeLessonHtml/Svg` (Task 1), `LessonContent`/`LessonVisual` (Task 2).
- Produces: `generateLessonImage(prompt: string, topicId: string): Promise<string | null>`; `finalizeLessonContent(content: LessonContent, topicId: string): Promise<LessonContent>` — every `createLesson` call site wraps content in this first.

- [ ] **Step 1: `lib/ai/images.ts`**

```ts
import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

const HOUSE_STYLE =
  "Clean, flat, friendly educational illustration for a GCSE learning app. " +
  "Soft colors, simple shapes, no embedded text or labels. ";

// Generates one lesson image with Gemini's image model ("nano banana"),
// stores it in the public `lesson-images` bucket, and returns its public
// URL. Returns null (never throws) when no key is set or anything fails —
// lessons must not block on images.
export async function generateLessonImage(
  prompt: string,
  topicId: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
      contents: HOUSE_STYLE + prompt,
    });

    const part = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    );
    if (!part?.inlineData?.data) return null;

    const bytes = Buffer.from(part.inlineData.data, "base64");
    const hash = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
    const path = `lessons/${topicId}/${hash}.png`;

    const supabase = createServiceClient();
    const { error } = await supabase.storage
      .from("lesson-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw error;

    return supabase.storage.from("lesson-images").getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error("Lesson image generation failed:", err);
    return null;
  }
}
```

- [ ] **Step 2: `lib/lesson-finalize.ts`**

```ts
import "server-only";
import type { LessonContent, LessonVisual } from "@/lib/ai/lessons";
import { sanitizeLessonHtml, sanitizeLessonSvg } from "@/lib/lesson-sanitize";
import { generateLessonImage } from "@/lib/ai/images";

// Runs between AI generation and createLesson(): sanitizes every visual
// (structure only — the site owns styling) and generates+stores any images.
// A visual that sanitizes to nothing, or an image that can't be generated,
// is dropped rather than failing the lesson.
export async function finalizeLessonContent(
  content: LessonContent,
  topicId: string
): Promise<LessonContent> {
  const sections = await Promise.all(
    content.sections.map(async (section) => {
      const visual = await finalizeVisual(section.visual, topicId);
      return { ...section, ...(visual ? { visual } : { visual: undefined }) };
    })
  );
  return { sections };
}

async function finalizeVisual(
  visual: LessonVisual | undefined | null,
  topicId: string
): Promise<LessonVisual | null> {
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
      if (!visual.prompt || !visual.alt) return null;
      const url = visual.url ?? (await generateLessonImage(visual.prompt, topicId)) ?? undefined;
      return { kind: "image", prompt: visual.prompt, alt: visual.alt, url };
    }
    default:
      return null;
  }
}
```

- [ ] **Step 3: Wrap all three `createLesson` call sites**

In `lib/content-pipeline.ts`:
```ts
generateLesson(...).then((content) =>
  finalizeLessonContent(content, topicId).then((final) => createLesson(topicId, final))
)
```
In `app/actions/lessons.ts` (`requestExtraHelpAction` and `tweakLessonAction`): after generating, `await createLesson(topicId, await finalizeLessonContent(lesson, topicId));` (same for `revised`). Import from `@/lib/lesson-finalize`.

- [ ] **Step 4: Run `npx tsc --noEmit` and `npx vitest run`** — expect PASS.

- [ ] **Step 5: Supabase bucket**

Create public storage bucket `lesson-images` (via Supabase MCP `execute_sql`: `insert into storage.buckets (id, name, public) values ('lesson-images','lesson-images',true) on conflict (id) do nothing;`).

### Task 4: Styling (`app/globals.css`)

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `.lesson-embed` class consumed by Task 5.

- [ ] **Step 1: Append a `lesson-embed` block** (match existing file conventions; uses only existing tokens)

```css
/* AI lesson visuals — the embed markup arrives with no classes or inline
   styles (enforced by lib/lesson-sanitize.ts), so all appearance for the
   allowed tags lives here. */
.lesson-embed {
  font-size: 0.875rem;
  color: var(--color-foreground);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.lesson-embed svg {
  display: block;
  margin-inline: auto;
  max-width: 100%;
  height: auto;
  color: var(--color-foreground);
}
.lesson-embed table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow: hidden;
}
.lesson-embed th,
.lesson-embed td {
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.lesson-embed thead th {
  background: var(--color-surface);
  font-weight: 600;
}
.lesson-embed ul { list-style: disc; padding-left: 1.25rem; }
.lesson-embed ol { list-style: decimal; padding-left: 1.25rem; }
.lesson-embed blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-surface);
  padding: 0.5rem 0.75rem;
  border-radius: 0 0.5rem 0.5rem 0;
  color: var(--color-muted);
}
.lesson-embed code {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  background: var(--color-surface);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}
.lesson-embed pre {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.75rem;
  overflow-x: auto;
}
.lesson-embed h4 { font-weight: 600; }
.lesson-embed figcaption,
.lesson-embed .lesson-embed-caption {
  font-size: 0.75rem;
  color: var(--color-muted);
  text-align: center;
}
.lesson-embed img {
  display: block;
  margin-inline: auto;
  max-width: 100%;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
}
```

(Check globals.css first: if tokens are exposed under different runtime names, e.g. plain `--primary`, use whichever form the rest of the CSS uses.)

### Task 5: Rendering (`lesson-visual.tsx` + player)

**Files:**
- Create: `app/learn/[topicId]/lesson-visual.tsx`
- Modify: `app/learn/[topicId]/lesson-player.tsx`

**Interfaces:**
- Consumes: `LessonVisual` (Task 2), `.lesson-embed` (Task 4).

- [ ] **Step 1: Component**

```tsx
import type { LessonVisual as Visual } from "@/lib/ai/lessons";

// Renders a sanitized lesson visual. Markup here has already been cleaned
// server-side by lib/lesson-finalize.ts before it was ever stored.
export function LessonVisual({ visual }: { visual: Visual }) {
  if (visual.kind === "svg") {
    return (
      <figure className="lesson-embed">
        <div dangerouslySetInnerHTML={{ __html: visual.svg }} />
        {visual.caption && (
          <figcaption className="lesson-embed-caption">{visual.caption}</figcaption>
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
    // eslint-disable-next-line @next/next/no-img-element -- remote AI image, unknown dimensions
    return (
      <figure className="lesson-embed">
        <img src={visual.url} alt={visual.alt} />
      </figure>
    );
  }
  return null;
}
```

- [ ] **Step 2: Player integration** — in the `teach` phase of `lesson-player.tsx`, between the explanation `<p>` and the example `<p>`:

```tsx
{sections[step.sectionIndex].visual && (
  <LessonVisual visual={sections[step.sectionIndex].visual} />
)}
```

Import `{ LessonVisual }` from `./lesson-visual`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`, `npm run lint`, `npx vitest run` all pass; then start the dev server, load a lesson page, confirm existing (visual-less) lessons still play, and confirm a hand-inserted test lesson with an svg + html visual renders themed in light and dark.
