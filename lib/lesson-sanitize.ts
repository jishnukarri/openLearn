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
  const themed = out.replace(/\s(fill|stroke)="([^"]*)"/g, (match, _name, value) =>
    THEME_COLOR.test(value) ? match : ""
  );
  return scopeSvgIds(themed);
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
