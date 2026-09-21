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
// then markdown. $$...$$ (display) before $...$ (inline) so the greedier
// display form wins when both could match.
const TOKEN = /(\$\$[^$]+\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
      return <Math key={i} tex={part.slice(2, -2)} display />;
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      return <Math key={i} tex={part.slice(1, -1)} />;
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
