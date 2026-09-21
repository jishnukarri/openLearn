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
  "markerHeight", "orient",
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
  return out.replace(/\s(fill|stroke)="([^"]*)"/g, (match, _name, value) =>
    THEME_COLOR.test(value) ? match : ""
  );
}
