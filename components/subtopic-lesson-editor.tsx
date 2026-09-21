"use client";

import "@uiw/react-md-editor/markdown-editor.css";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X, ImageIcon } from "lucide-react";
import type { LessonCheck, LessonContent, LessonSection, LessonVisual } from "@/lib/ai/lessons";
import { saveSubtopicLessonAction, uploadLessonImageAction } from "@/app/actions/lessons";
import { Button } from "@/components/button";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

// SSR-safe import, the editor uses browser APIs.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// Defined once at module level so the MDEditor doesn't re-mount when the parent re-renders.
const PREVIEW_OPTIONS = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeKatex],
};

// ─── Image upload panel ────────────────────────────────────────────────────────

type VisualPosition = "top" | "middle" | "bottom";

function ImagePanel({
  visual,
  position,
  onVisualChange,
  onPositionChange,
}: {
  visual: LessonVisual | null | undefined;
  position: VisualPosition;
  onVisualChange: (v: LessonVisual | null) => void;
  onPositionChange: (p: VisualPosition) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageVisual = visual?.kind === "image" ? visual : null;

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const url = await uploadLessonImageAction(fd);
      onVisualChange({ kind: "image", prompt: "", alt: imageVisual?.alt ?? "", url });
    } catch (e: any) {
      setError(e.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Section image</span>
        {imageVisual && (
          <button type="button" onClick={() => onVisualChange(null)} className="text-2xs text-muted hover:text-error">
            Remove
          </button>
        )}
      </div>

      {imageVisual?.url ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageVisual.url} alt={imageVisual.alt || "Section image"} className="max-h-36 rounded-lg object-contain" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="self-start text-2xs text-muted underline hover:text-foreground">
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-surface px-4 py-4 text-xs text-muted hover:border-primary hover:text-foreground disabled:opacity-60"
        >
          {uploading ? "Uploading…" : (
            <>
              <ImageIcon className="size-5" strokeWidth={1.75} />
              <span>Click to upload image</span>
              <span className="text-3xs">JPG · PNG · GIF · WebP, max 10 MB</span>
            </>
          )}
        </button>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {error && <p className="text-2xs text-red-500">{error}</p>}

      {imageVisual && (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Alt text
            <input
              value={imageVisual.alt}
              onChange={(e) => onVisualChange({ ...imageVisual, alt: e.target.value })}
              placeholder="Describe the image for screen readers"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-medium text-muted">Position</legend>
            <div className="flex flex-col gap-1">
              {(["top", "middle", "bottom"] as const).map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="radio" checked={position === p} onChange={() => onPositionChange(p)} className="accent-primary" />
                  {p === "top" ? "Before explanation" : p === "middle" ? "Between explanation & example" : "After example"}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}

// ─── Check editor ──────────────────────────────────────────────────────────────

function CheckEditor({ check, onChange }: { check: LessonCheck; onChange: (p: Partial<LessonCheck>) => void }) {
  const inputCls = "rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <p className="text-xs font-semibold text-foreground">Quick check, {check.kind ?? "mcq"}</p>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Question
        <input value={check.question} onChange={(e) => onChange({ question: e.target.value })} className={inputCls} />
      </label>
      {"options" in check && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {check.options.map((opt, i) => (
              <label key={i} className="flex flex-col gap-1 text-xs font-medium text-muted">
                Option {i + 1}
                <input value={opt} onChange={(e) => { const opts = [...check.options]; opts[i] = e.target.value; onChange({ options: opts }); }} className={inputCls} />
              </label>
            ))}
          </div>
          {"correctIndex" in check && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Correct option
              <select value={check.correctIndex} onChange={(e) => onChange({ correctIndex: Number(e.target.value) })} className={inputCls}>
                {check.options.map((_, i) => <option key={i} value={i}>Option {i + 1}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      {"accepted" in check && (
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Accepted answers (comma-separated)
          <input
            value={check.accepted.join(", ")}
            onChange={(e) => onChange({ accepted: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            className={inputCls}
          />
        </label>
      )}
    </div>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────────

export function SubtopicLessonEditor({
  subtopicId,
  initialContent,
}: {
  subtopicId: string;
  initialContent: LessonContent;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<LessonContent>(initialContent);
  const [selectedSection, setSelectedSection] = useState(0);

  // Prevent body scroll while drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function updateSection(index: number, patch: Partial<LessonSection>) {
    setContent((c) => ({
      ...c,
      sections: c.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function updateCheck(index: number, patch: Partial<LessonCheck>) {
    const s = content.sections[index];
    updateSection(index, { check: { ...s.check, ...patch } as LessonCheck });
  }

  const section = content.sections[selectedSection];

  return (
    <>
      {/* ── Bottom bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-between border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md">
        <p className="text-xs text-muted">Teacher preview, editing available below</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 active:scale-95 transition-transform"
        >
          <span>✏</span> Edit lesson
        </button>
      </div>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Drawer ── */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-surface shadow-2xl transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"}`}
        style={{ height: "92dvh" }}
        aria-modal="true"
        role="dialog"
        aria-label="Edit lesson"
      >
        {/* Drag handle */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="mx-auto h-1 w-10 rounded-full bg-border" />
            <span className="text-sm font-semibold text-foreground">Edit lesson</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
            aria-label="Close editor"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {content.sections.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedSection(i)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedSection === i ? "bg-primary text-white" : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              <span className="flex size-4 items-center justify-center rounded-full border border-current text-3xs">{i + 1}</span>
              Section {i + 1}
            </button>
          ))}
        </div>

        {/* Editor body */}
        {section && (
          <form action={saveSubtopicLessonAction} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="subtopicId" value={subtopicId} />
            <input type="hidden" name="content" value={JSON.stringify(content)} readOnly />

            <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
              {/* Left column, text fields */}
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                  Heading
                  <input
                    value={section.heading}
                    onChange={(e) => updateSection(selectedSection, { heading: e.target.value })}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>

                <div className="flex flex-col gap-1" data-color-mode="auto">
                  <span className="text-xs font-semibold text-muted">Explanation</span>
                  <MDEditor
                    value={section.explanation}
                    onChange={(v) => updateSection(selectedSection, { explanation: v ?? "" })}
                    height={220}
                    preview="live"
                    previewOptions={PREVIEW_OPTIONS}
                  />
                </div>

                <div className="flex flex-col gap-1" data-color-mode="auto">
                  <span className="text-xs font-semibold text-muted">Worked example</span>
                  <MDEditor
                    value={section.example}
                    onChange={(v) => updateSection(selectedSection, { example: v ?? "" })}
                    height={180}
                    preview="live"
                    previewOptions={PREVIEW_OPTIONS}
                  />
                </div>
              </div>

              {/* Right column, image + check */}
              <div className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4 md:flex">
                <ImagePanel
                  visual={section.visual}
                  position={(section.visualPosition ?? "middle") as VisualPosition}
                  onVisualChange={(v) => updateSection(selectedSection, { visual: v })}
                  onPositionChange={(p) => updateSection(selectedSection, { visualPosition: p })}
                />
                <CheckEditor check={section.check} onChange={(p) => updateCheck(selectedSection, p)} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={selectedSection === 0}
                  onClick={() => setSelectedSection((i) => i - 1)}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={selectedSection === content.sections.length - 1}
                  onClick={() => setSelectedSection((i) => i + 1)}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
              <Button type="submit" size="compact">Save changes</Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
