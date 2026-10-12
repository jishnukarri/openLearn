import type { ReactNode } from "react";
import katex from "katex";

// AI-written lesson text often carries inline markdown (**bold**, *italic*,
// `code`) and LaTeX math ($x^2$, $$\frac{a}{b}$$) even when not explicitly
// asked to. Render both properly instead of showing raw symbols.
// Inline-only on purpose, no links, no block markdown.
export function RichText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <>{renderInline(text)}</>;
}

// Math tokens first (so **bold** inside $...$ isn't mistaken for markdown),
// then markdown. Display forms ($$..$$, \[..\]) before inline ones. Inline
// $..$ follows the pandoc rule (no space just inside the dollars, and the
// closing $ is not followed by a digit) so "$5 and $10" stays prose. Bare
// formulas with subscripts, such as C_3H_6 or H_2O, are typeset too, since
// the AI often drops the dollar signs around them.
const FORMULA = String.raw`(?<![\w$\\])(?:[A-Z][a-z]?(?:_\{\d+\}|_\d+)?){1,8}(?![\w$])`;
const TOKEN = new RegExp(
  String.raw`(\\\[[^\]]+\\\]|\\\([^)]+\\\)|\$\$[^$]+\$\$|\$(?!\s)[^$\n]*?[^$\s]\$(?!\d)|\$[^\s$]\$(?!\d)|${FORMULA}|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\x60[^\x60]+\x60)`,
  "g"
);

const isBareFormula = (part: string) =>
  part.includes("_") && /^(?:[A-Z][a-z]?(?:_\{\d+\}|_\d+)?){1,8}$/.test(part);

function renderInline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return part;
    if (part.startsWith("\\[") && part.endsWith("\\]")) {
      return <Math key={i} tex={part.slice(2, -2)} display />;
    }
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      return <Math key={i} tex={part.slice(2, -2)} />;
    }
    if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
      return <Math key={i} tex={part.slice(2, -2)} display />;
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      return <Math key={i} tex={part.slice(1, -1)} />;
    }
    if (isBareFormula(part)) {
      return <Math key={i} tex={part} />;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="font-[family-name:var(--font-mono)] text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function Math({ tex, display = false }: { tex: string; display?: boolean }) {
  let html: string;
  try {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "html" });
  } catch {
    return <span>{display ? `$$${tex}$$` : `$${tex}$`}</span>;
  }
  const Tag = display ? "div" : "span";
  return <Tag className="katex-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
