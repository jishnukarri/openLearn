"use client";

import { useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { cn } from "@/lib/utils";

// Turns the editor's DOM into plain text with light markdown (**bold**,
// *italic*, "- " bullets, "1. " numbers) so answers reach the marker as text.
function serialize(root: HTMLElement): string {
  const out: string[] = [];
  const walk = (node: Node, inline: { b: boolean; i: boolean }): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    const tag = node.tagName;
    if (tag === "BR") return "\n";
    const next = { b: inline.b || tag === "B" || tag === "STRONG", i: inline.i || tag === "I" || tag === "EM" };
    const inner = Array.from(node.childNodes).map((c) => walk(c, next)).join("");
    if (tag === "UL" || tag === "OL") {
      const items = Array.from(node.children).filter((c) => c.tagName === "LI");
      return (
        "\n" +
        items
          .map((li, n) => `${tag === "OL" ? `${n + 1}.` : "-"} ${walk(li, next).trim()}`)
          .join("\n") +
        "\n"
      );
    }
    if (tag === "LI") return inner;
    let text = inner;
    if (tag === "B" || tag === "STRONG") text = inner.trim() ? `**${inner}**` : inner;
    else if (tag === "I" || tag === "EM") text = inner.trim() ? `*${inner}*` : inner;
    if (tag === "DIV" || tag === "P") return `\n${text}\n`;
    return text;
  };
  Array.from(root.childNodes).forEach((n) => out.push(walk(n, { b: false, i: false })));
  return out.join("").replace(/\*\*\*\*|\*\*\s*\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function exec(command: string) {
  document.execCommand(command, false);
}

const TOOLS = [
  { id: "bold", label: "Bold", hint: "Ctrl+B", icon: Bold, command: "bold" },
  { id: "italic", label: "Italic", hint: "Ctrl+I", icon: Italic, command: "italic" },
  { id: "underline", label: "Underline", hint: "Ctrl+U", icon: Underline, command: "underline" },
  { id: "ul", label: "Bullet list", hint: "Ctrl+Shift+8", icon: List, command: "insertUnorderedList" },
  { id: "ol", label: "Numbered list", hint: "Ctrl+Shift+7", icon: ListOrdered, command: "insertOrderedList" },
] as const;

// A written-answer box for questions that need more than recall: grows with
// the text, can be dragged taller, and supports the usual shortcuts.
export function AnswerEditor({
  onChange,
  placeholder = "Write your answer…",
  minRows = 6,
  label = "Your answer",
  className,
}: {
  onChange: (text: string) => void;
  placeholder?: string;
  minRows?: number;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});

  function sync() {
    if (ref.current) onChange(serialize(ref.current));
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
    });
  }

  function run(command: string) {
    ref.current?.focus();
    exec(command);
    sync();
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-surface focus-within:ring-2 focus-within:ring-primary",
        className
      )}
    >
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={`${t.label} (${t.hint})`}
            aria-label={t.label}
            aria-pressed={!!active[t.id]}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.command)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground",
              active[t.id] && "bg-background text-foreground"
            )}
          >
            <t.icon className="size-4" strokeWidth={2} aria-hidden />
          </button>
        ))}
        <span className="ml-auto hidden pr-2 text-sm text-muted sm:inline">Drag the corner to make it taller</span>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{ minHeight: `${minRows * 1.6}rem`, resize: "vertical", overflow: "auto" }}
        onInput={sync}
        onKeyUp={sync}
        onMouseUp={sync}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        onKeyDown={(e) => {
          const mod = e.ctrlKey || e.metaKey;
          if (mod && e.shiftKey && (e.key === "8" || e.key === "*")) {
            e.preventDefault();
            run("insertUnorderedList");
          } else if (mod && e.shiftKey && (e.key === "7" || e.key === "&")) {
            e.preventDefault();
            run("insertOrderedList");
          }
        }}
        className="max-h-[70vh] px-4 py-3 text-base leading-relaxed text-foreground outline-none empty:before:text-muted empty:before:content-[attr(data-placeholder)] [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc"
      />
    </div>
  );
}
