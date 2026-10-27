"use client";

import "@uiw/react-md-editor/markdown-editor.css";
import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { X, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import type { LessonCheck, LessonContent, LessonSection, LessonVisual } from "@/lib/ai/lessons";
import { saveSubtopicLessonAction, uploadLessonImageAction } from "@/app/actions/lessons";
import { Button } from "@/components/button";
import { validateLesson, splitAccepted, sectionIndexOfPath, type LessonIssue } from "@/lib/lesson-validate";
import { exampleChanged } from "@/lib/lesson-edit";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

// SSR-safe import, the editor uses browser APIs.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// Defined once at module level so the MDEditor doesn't re-mount when the parent re-renders.
const PREVIEW_OPTIONS = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeKatex],
};

// ─── Shared bits ───────────────────────────────────────────────────────────────

const inputCls = "rounded-lg border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";
const border = (bad: boolean) => (bad ? "border-error" : "border-border");

type IssueMap = Map<string, string>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-sm text-error">{message}</p>;
}

// ─── Image upload panel ────────────────────────────────────────────────────────

type VisualPosition = "top" | "middle" | "bottom";

function ImagePanel({
  visual,
  position,
  heading,
  onVisualChange,
  onPositionChange,
}: {
  visual: LessonVisual | null | undefined;
  position: VisualPosition;
  heading: string;
  onVisualChange: (v: LessonVisual | null) => void;
  onPositionChange: (p: VisualPosition) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"replace" | "remove" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageVisual = visual?.kind === "image" ? visual : null;
  const aiDiagram = visual?.kind === "svg" || visual?.kind === "html" ? visual : null;

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const url = await uploadLessonImageAction(fd);
      // Never leave the alt text empty: start from the old alt or the heading.
      const alt = imageVisual?.alt?.trim() || heading.trim() || "Section image";
      onVisualChange({ kind: "image", prompt: "", alt, url });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const smallBtn = "self-start text-sm text-muted underline hover:text-foreground";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Section image</h3>
        {(imageVisual || aiDiagram) && confirm !== "remove" && (
          <button type="button" onClick={() => setConfirm("remove")} className="text-sm text-muted hover:text-error">
            Remove
          </button>
        )}
      </div>

      {confirm && (
        <div role="alertdialog" aria-label="Please confirm" className="flex flex-col gap-2 rounded-lg border border-error bg-surface p-3">
          <p className="text-sm text-foreground">
            {confirm === "replace"
              ? "Replace the AI diagram with your own image? The diagram will be lost."
              : "Remove this picture from the section?"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-error px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => {
                const action = confirm;
                setConfirm(null);
                if (action === "replace") fileInputRef.current?.click();
                else onVisualChange(null);
              }}
            >
              {confirm === "replace" ? "Yes, replace it" : "Yes, remove it"}
            </button>
            <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground" onClick={() => setConfirm(null)}>
              Keep it
            </button>
          </div>
        </div>
      )}

      {aiDiagram ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">AI diagram</p>
          <div
            role="img"
            aria-label={`AI diagram for ${heading || "this section"} (read only)`}
            className="max-h-36 overflow-hidden rounded-lg border border-border bg-surface p-2 [&_svg]:max-h-32 [&_svg]:w-full"
            // Already sanitized (lib/lesson-sanitize) when the lesson was stored.
            dangerouslySetInnerHTML={{ __html: aiDiagram.kind === "svg" ? aiDiagram.svg : aiDiagram.html }}
          />
          <p className="text-sm text-muted">Made by AI. You can&apos;t edit it here.</p>
          <button type="button" disabled={uploading} onClick={() => setConfirm("replace")} className={smallBtn}>
            Replace with my image
          </button>
        </div>
      ) : imageVisual?.url ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageVisual.url} alt={imageVisual.alt || heading || "Section image"} className="max-h-36 rounded-lg object-contain" />
          <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className={smallBtn}>
            {uploading ? "Uploading…" : "Replace"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-surface px-4 py-4 text-sm text-muted hover:border-primary hover:text-foreground disabled:opacity-60"
        >
          {uploading ? "Uploading…" : (
            <>
              <ImageIcon className="size-5" strokeWidth={1.75} />
              <span>Click to upload image</span>
              <span className="text-sm">JPG, PNG, GIF or WebP, max 10 MB</span>
            </>
          )}
        </button>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" aria-label="Choose an image"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      {imageVisual && (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium text-muted">
            Picture description (alt text)
            <input
              value={imageVisual.alt}
              onChange={(e) => onVisualChange({ ...imageVisual, alt: e.target.value })}
              onBlur={() => { if (!imageVisual.alt.trim()) onVisualChange({ ...imageVisual, alt: heading.trim() || "Section image" }); }}
              placeholder="Describe the picture for students who can't see it"
              className={`${inputCls} ${border(false)}`}
            />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium text-muted">Position</legend>
            <div className="flex flex-col gap-1">
              {(["top", "middle", "bottom"] as const).map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="image-position" checked={position === p} onChange={() => onPositionChange(p)} className="accent-primary" />
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

function AcceptedInput({ accepted, onChange, bad, describedBy }: { accepted: string[]; onChange: (a: string[]) => void; bad: boolean; describedBy?: string }) {
  // Keep the raw text so typing a comma or Enter isn't swallowed mid-edit.
  const [raw, setRaw] = useState(accepted.join(", "));
  return (
    <textarea
      value={raw}
      rows={2}
      aria-invalid={bad}
      aria-describedby={describedBy}
      onChange={(e) => { setRaw(e.target.value); onChange(splitAccepted(e.target.value)); }}
      className={`${inputCls} ${border(bad)}`}
    />
  );
}

function CheckEditor({
  check,
  onChange,
  issues,
  base,
}: {
  check: LessonCheck;
  onChange: (p: Partial<LessonCheck>) => void;
  issues: IssueMap;
  base: string;
}) {
  const err = (suffix: string) => issues.get(`${base}${suffix}`);
  const kind = check.kind ?? "mcq";
  const kindLabel = { mcq: "Multiple choice", multi: "Choose all that apply", short: "Short answer", matching: "Matching" }[kind];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <h3 className="text-sm font-semibold text-foreground">Quick check: {kindLabel}</h3>
      <label className="flex flex-col gap-1 text-sm font-medium text-muted">
        Question
        <input value={check.question} onChange={(e) => onChange({ question: e.target.value })}
          aria-invalid={!!err(".question")} aria-describedby={err(".question") ? "err-question" : undefined}
          className={`${inputCls} ${border(!!err(".question"))}`} />
      </label>
      <FieldError id="err-question" message={err(".question")} />

      {"options" in check && (
        <>
          <div className="flex flex-col gap-2">
            {check.options.map((opt, i) => {
              const msg = err(`.options.${i}`);
              const isCorrect = "correctIndex" in check ? check.correctIndex === i : "correctIndexes" in check ? check.correctIndexes.includes(i) : false;
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-muted">
                      Option {i + 1}
                      <input value={opt} aria-invalid={!!msg} aria-describedby={msg ? `err-opt-${i}` : undefined}
                        onChange={(e) => { const opts = [...check.options]; opts[i] = e.target.value; onChange({ options: opts }); }}
                        className={`${inputCls} ${border(!!msg)}`} />
                    </label>
                    <label className="flex items-center gap-1.5 pb-2 text-sm text-foreground">
                      <input
                        type={"correctIndex" in check ? "radio" : "checkbox"}
                        name="correct-option"
                        checked={isCorrect}
                        className="accent-primary"
                        onChange={(e) => {
                          if ("correctIndex" in check) onChange({ correctIndex: i });
                          else if ("correctIndexes" in check) {
                            const set = new Set(check.correctIndexes);
                            if (e.target.checked) set.add(i); else set.delete(i);
                            onChange({ correctIndexes: [...set].sort((x, y) => x - y) });
                          }
                        }}
                      />
                      Correct
                    </label>
                    <button type="button" aria-label={`Remove option ${i + 1}`} disabled={check.options.length <= 2}
                      onClick={() => {
                        const options = check.options.filter((_, j) => j !== i);
                        if ("correctIndex" in check) onChange({ options, correctIndex: check.correctIndex === i ? -1 : check.correctIndex > i ? check.correctIndex - 1 : check.correctIndex });
                        else if ("correctIndexes" in check) onChange({ options, correctIndexes: check.correctIndexes.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) });
                      }}
                      className="mb-1 rounded-lg p-2 text-muted hover:text-error disabled:opacity-40">
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                  <FieldError id={`err-opt-${i}`} message={msg} />
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => onChange({ options: [...check.options, ""] })}
            className="flex items-center gap-1 self-start text-sm text-muted underline hover:text-foreground">
            <Plus className="size-4" strokeWidth={1.75} /> Add an option
          </button>
          <FieldError id="err-options" message={err(".options") ?? err(".correctIndex") ?? err(".correctIndexes")} />
        </>
      )}

      {"accepted" in check && (
        <div className="flex flex-col gap-1">
          <label htmlFor="accepted-input" className="text-sm font-medium text-muted">
            Accepted answers (separate with commas or new lines)
          </label>
          <div id="accepted-input-wrap" className="flex flex-col">
            <AcceptedInput accepted={check.accepted} bad={!!err(".accepted")} describedBy={err(".accepted") ? "err-accepted" : undefined}
              onChange={(accepted) => onChange({ accepted })} />
          </div>
          <FieldError id="err-accepted" message={err(".accepted")} />
        </div>
      )}

      {"pairs" in check && (
        <div className="flex flex-col gap-2">
          {check.pairs.map((pair, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-end gap-2">
                {(["left", "right"] as const).map((side) => (
                  <label key={side} className="flex flex-1 flex-col gap-1 text-sm font-medium text-muted">
                    Pair {i + 1}, {side}
                    <input value={pair[side]} aria-invalid={!!err(`.pairs.${i}.${side}`)}
                      onChange={(e) => onChange({ pairs: check.pairs.map((p, j) => (j === i ? { ...p, [side]: e.target.value } : p)) })}
                      className={`${inputCls} ${border(!!err(`.pairs.${i}.${side}`))}`} />
                  </label>
                ))}
                <button type="button" aria-label={`Remove pair ${i + 1}`} disabled={check.pairs.length <= 2}
                  onClick={() => onChange({ pairs: check.pairs.filter((_, j) => j !== i) })}
                  className="mb-1 rounded-lg p-2 text-muted hover:text-error disabled:opacity-40">
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              </div>
              <FieldError id={`err-pair-${i}`} message={err(`.pairs.${i}.left`) ?? err(`.pairs.${i}.right`)} />
            </div>
          ))}
          <button type="button" onClick={() => onChange({ pairs: [...check.pairs, { left: "", right: "" }] })}
            className="flex items-center gap-1 self-start text-sm text-muted underline hover:text-foreground">
            <Plus className="size-4" strokeWidth={1.75} /> Add a pair
          </button>
          <FieldError id="err-pairs" message={err(".pairs")} />
        </div>
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
  const [issues, setIssues] = useState<LessonIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    const found = validateLesson(content);
    setIssues(found);
    if (found.length) {
      setSelectedSection(Math.max(0, sectionIndexOfPath(found[0].path)));
      return;
    }
    const fd = new FormData();
    fd.set("subtopicId", subtopicId);
    fd.set("content", JSON.stringify(content));
    startTransition(async () => {
      try {
        const result = await saveSubtopicLessonAction(fd);
        if (result && !result.ok) {
          setIssues(result.issues);
          setSelectedSection(Math.max(0, sectionIndexOfPath(result.issues[0]?.path ?? "")));
        }
      } catch (err) {
        // A redirect after a successful save is not an error.
        if (err instanceof Error && /NEXT_REDIRECT/.test(err.message + (err as { digest?: string }).digest)) throw err;
        setSaveError("Sorry, the lesson could not be saved. Please try again.");
      }
    });
  }

  const section = content.sections[selectedSection];
  const issueMap: IssueMap = new Map();
  for (const i of issues) if (!issueMap.has(i.path)) issueMap.set(i.path, i.message);
  const sectionErrors = new Set(issues.map((i) => sectionIndexOfPath(i.path)));
  const base = `sections.${selectedSection}`;
  const stale = section ? exampleChanged(initialContent.sections[selectedSection], section) : false;

  return (
    <>
      {/* ── Bottom bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-between border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md">
        <p className="text-sm text-muted">Teacher preview, editing available below</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 active:scale-95 transition-transform"
        >
          <Pencil className="size-4" strokeWidth={2} /> Edit lesson
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
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                selectedSection === i ? "bg-primary text-white" : "text-muted hover:bg-background hover:text-foreground"
              } ${sectionErrors.has(i) ? "ring-2 ring-error" : ""}`}
            >
              Section {i + 1}
              {sectionErrors.has(i) && <span className="text-sm">needs fixing</span>}
            </button>
          ))}
        </div>

        {/* Editor body */}
        {section && (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            {issues.length > 0 && (
              <div role="alert" className="shrink-0 border-b border-error bg-background px-4 py-3">
                <p className="text-sm font-semibold text-error">Please fix {issues.length === 1 ? "this before saving" : `these ${issues.length} things before saving`}:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
                  {issues.slice(0, 5).map((i) => (
                    <li key={i.path}>
                      <button type="button" className="text-left underline" onClick={() => setSelectedSection(Math.max(0, sectionIndexOfPath(i.path)))}>
                        {i.message}
                      </button>
                    </li>
                  ))}
                </ul>
                {issues.length > 5 && <p className="mt-1 text-sm text-muted">and {issues.length - 5} more.</p>}
              </div>
            )}
            {saveError && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-error">{saveError}</p>}

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
              {/* Left column, text fields */}
              <div className="flex flex-1 flex-col gap-4 p-4 md:min-h-0 md:overflow-y-auto">
                <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                  Heading
                  <input
                    value={section.heading}
                    aria-invalid={!!issueMap.get(`${base}.heading`)}
                    onChange={(e) => updateSection(selectedSection, { heading: e.target.value })}
                    className={`rounded-lg border bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary ${border(!!issueMap.get(`${base}.heading`))}`}
                  />
                </label>
                <FieldError id="err-heading" message={issueMap.get(`${base}.heading`)} />

                <div className={`flex flex-col gap-1 rounded-lg ${issueMap.get(`${base}.explanation`) ? "ring-2 ring-error" : ""}`} data-color-mode="auto">
                  <span className="text-sm font-semibold text-muted">Explanation</span>
                  <MDEditor
                    value={section.explanation}
                    onChange={(v) => updateSection(selectedSection, { explanation: v ?? "" })}
                    height={220}
                    preview="live"
                    previewOptions={PREVIEW_OPTIONS}
                  />
                </div>
                <FieldError id="err-explanation" message={issueMap.get(`${base}.explanation`)} />

                <div className={`flex flex-col gap-1 rounded-lg ${issueMap.get(`${base}.example`) ? "ring-2 ring-error" : ""}`} data-color-mode="auto">
                  <span className="text-sm font-semibold text-muted">Worked example</span>
                  <MDEditor
                    value={section.example}
                    onChange={(v) => updateSection(selectedSection, { example: v ?? "" })}
                    height={180}
                    preview="live"
                    previewOptions={PREVIEW_OPTIONS}
                  />
                </div>
                <FieldError id="err-example" message={issueMap.get(`${base}.example`)} />
                {stale && (
                  <p role="status" className="text-sm text-foreground">
                    The animation for this example will be rebuilt when you save.
                  </p>
                )}
              </div>

              {/* Image + check */}
              <div className="flex w-full shrink-0 flex-col gap-4 border-t border-border p-4 md:w-80 md:overflow-y-auto md:border-l md:border-t-0">
                <ImagePanel
                  key={selectedSection}
                  visual={section.visual}
                  heading={section.heading}
                  position={(section.visualPosition ?? "middle") as VisualPosition}
                  onVisualChange={(v) => updateSection(selectedSection, { visual: v })}
                  onPositionChange={(p) => updateSection(selectedSection, { visualPosition: p })}
                />
                <CheckEditor key={`c${selectedSection}`} check={section.check} issues={issueMap} base={`${base}.check`} onChange={(p) => updateCheck(selectedSection, p)} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={selectedSection === 0}
                  onClick={() => setSelectedSection((i) => i - 1)}
                  className="rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={selectedSection === content.sections.length - 1}
                  onClick={() => setSelectedSection((i) => i + 1)}
                  className="rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
              <Button type="submit" size="compact" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
