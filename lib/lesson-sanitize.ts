import sanitizeHtml from "sanitize-html";

// AI-authored lesson visuals carry structure only — the site owns all
// styling, so style/class are never allowed anywhere and SVG colors must
// be theme tokens (THEME_COLOR). Applied before a lesson is saved
// (lib/lesson-finalize.ts) and again when it is loaded for rendering.
const THEME_COLOR = /^(currentColor|none|var\(--color-[a-z-]+\))$/;

const HTML_TAGS = [
  "p", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
  "strong", "em", "code", "pre", "blockquote", "figure", "figcaption",
  "br", "sub", "sup", "h4",
];

const SVG_TAGS = [
  "svg", "g", "path", "line", "polyline", "polygon", "rect", "circle",
  "ellipse", "text", "tspan", "defs", "marker", "title",
];

const SVG_ATTRS = [
  "viewBox", "width", "height", "d", "x", "y", "x1", "y1", "x2", "y2",
  "cx", "cy", "r", "rx", "ry", "points", "transform", "text-anchor",
  "font-size", "stroke-width", "stroke-dasharray", "stroke-linecap",
  "stroke-linejoin", "fill-opacity", "stroke-opacity", "opacity",
  "marker-end", "marker-start", "id", "refX", "refY", "markerWidth",
  "markerHeight", "orient", "preserveAspectRatio", "font-weight",
];

// Tags whose text content must vanish with the tag, not leak into the
// output (sanitize-html's default list plus embed-capable SVG escapes).
const NON_TEXT_TAGS = [
  "script", "style", "textarea", "option", "noscript", "iframe",
  "foreignObject", "foreignobject", "object", "embed",
];

function clean(
  input: string,
  tags: string[],
  attrs: sanitizeHtml.IOptions["allowedAttributes"]
): string {
  return sanitizeHtml(input, {
    allowedTags: tags,
    allowedAttributes: attrs,
    disallowedTagsMode: "discard",
    nonTextTags: NON_TEXT_TAGS,
    parser: { lowerCaseAttributeNames: false },
  }).trim();
}

export function sanitizeLessonHtml(html: string): string {
  return clean(html, HTML_TAGS, {});
}

export function sanitizeLessonSvg(svg: string): string {
  const out = clean(svg, SVG_TAGS, { "*": [...SVG_ATTRS, "fill", "stroke"] });
  if (!out.startsWith("<svg")) return "";
  // Colors are structural in SVG, so fill/stroke survive the allowlist —
  // but only with theme-token values; anything else is dropped here.
  const themed = out.replace(/\s(fill|stroke)="([^"]*)"/g, (match, _name, value) =>
    THEME_COLOR.test(value) ? match : ""
  );
  return normaliseSvg(scopeSvgIds(themed));
}

// ── Rendering robustness ────────────────────────────────────────────────
// Text with no fill would inherit the page colour (invisible on a dark
// page), so give it currentColor, which the white lesson panel pins to a
// dark ink. The root svg drops fixed pixel sizes (CSS makes it fluid),
// always has a viewBox, and the viewBox grows to contain labels that a
// conservative width estimate says would be clipped.
const AVG_CHAR_EM = 0.58;
const MAX_VIEWBOX = 4000;

export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * AVG_CHAR_EM;
}

function num(attrs: string, name: string): number | null {
  const m = new RegExp(`(?:^|\\s)${name}="(-?[0-9.]+)(?:px)?"`).exec(attrs);
  return m ? Number(m[1]) : null;
}

export function normaliseSvg(svg: string): string {
  const rootMatch = /^<svg\b([^>]*)>/.exec(svg);
  if (!rootMatch) return svg;
  let rootAttrs = rootMatch[1];

  const body = svg
    .slice(rootMatch[0].length)
    .replace(/<(text|tspan)\b([^>]*)>/g, (full, tag: string, attrs: string) =>
      /\sfill="/.test(` ${attrs}`) ? full : `<${tag} fill="currentColor"${attrs}>`
    );

  let vb = /\sviewBox="([^"]*)"/.exec(` ${rootAttrs}`)?.[1]
    ?.trim().split(/[\s,]+/).map(Number);
  if (!vb || vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = num(rootAttrs, "width") ?? 400;
    const h = num(rootAttrs, "height") ?? 240;
    vb = [0, 0, w > 0 ? w : 400, h > 0 ? h : 240];
  }
  const [minX, minY, w, h] = vb;
  let loX = minX;
  let loY = minY;
  let maxX = minX + w;
  let maxY = minY + h;

  const re = /<text\b([^>]*)>([^<]*)(?:<\/text>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const attrs = m[1];
    if (/\stransform="/.test(` ${attrs}`)) continue;
    const text = m[2].trim();
    const x = num(attrs, "x");
    const y = num(attrs, "y");
    if (!text || x === null) continue;
    const fs = num(attrs, "font-size") ?? 12;
    const width = estimateTextWidth(text, fs);
    const anchor = /text-anchor="(start|middle|end)"/.exec(attrs)?.[1] ?? "start";
    const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    loX = Math.min(loX, left);
    maxX = Math.max(maxX, left + width);
    if (y !== null) {
      loY = Math.min(loY, y - fs * 0.8);
      maxY = Math.max(maxY, y + fs * 0.35);
    }
  }
  const pad = 6;
  if (loX < minX) loX -= pad;
  if (maxX > minX + w) maxX += pad;
  if (loY < minY) loY -= pad;
  if (maxY > minY + h) maxY += pad;
  const nw = Math.min(maxX - loX, MAX_VIEWBOX);
  const nh = Math.min(maxY - loY, MAX_VIEWBOX);
  const round = (n: number) => Math.round(n * 10) / 10;

  rootAttrs = rootAttrs.replace(/\s(?:width|height|viewBox|preserveAspectRatio)="[^"]*"/g, "");
  return `<svg viewBox="${round(loX)} ${round(loY)} ${round(nw)} ${round(nh)}"${rootAttrs}>${body}`;
}

// SVG ids share the page's id namespace, so an AI-written id="root" could
// clobber page elements (DOM clobbering) and marker-* urls could point at an
// external document. Prefix every id, keep marker references to local
// #fragments only, and drop anything else.
const ID_PREFIX = "lv-";
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;

// Sanitising runs on save and again on load, so never prefix twice.
const prefixed = (id: string) => (id.startsWith(ID_PREFIX) ? id : `${ID_PREFIX}${id}`);

function scopeSvgIds(svg: string): string {
  return svg
    .replace(/\sid="([^"]*)"/g, (match, id: string) => (SAFE_ID.test(id) ? ` id="${prefixed(id)}"` : ""))
    .replace(/\s(marker-end|marker-start)="([^"]*)"/g, (match, name: string, value: string) => {
      const m = /^url\(#([A-Za-z][A-Za-z0-9_-]{0,40})\)$/.exec(value);
      return m ? ` ${name}="url(#${prefixed(m[1])})"` : "";
    });
}
