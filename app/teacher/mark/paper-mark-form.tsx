"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { markPaperAction, type MarkPaperResult } from "./actions";
import { Button } from "@/components/button";
import { AiLoading } from "@/components/ai-loading";

export function PaperMarkForm() {
  const [result, setResult] = useState<MarkPaperResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    startTransition(async () => {
      const r = await markPaperAction(fd);
      setResult(r);
    });
  }

  const marksAwarded = result?.ok ? result.result.marksAwarded : 0;
  const marksAvailable = result?.ok ? result.marksAvailable : 0;
  const pct = marksAvailable > 0 ? Math.round((marksAwarded / marksAvailable) * 100) : 0;

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex flex-col gap-8">
      {isPending && (
        <AiLoading
          overlay
          title="Marking paper…"
          messages={["Reading handwriting…", "Checking against markscheme…", "Almost done…"]}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="question" className="text-sm font-medium text-foreground">Question</label>
          <textarea
            id="question"
            name="question"
            rows={3}
            required
            placeholder="e.g. Explain why enzymes are described as biological catalysts. [3 marks]"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="markscheme" className="text-sm font-medium text-foreground">
            Markscheme points
            <span className="ml-2 text-sm font-normal text-muted">one per line</span>
          </label>
          <textarea
            id="markscheme"
            name="markscheme"
            rows={5}
            required
            placeholder={"- Enzymes are proteins / made of amino acids\n- They lower activation energy\n- Not used up / remain unchanged at end of reaction"}
            className="rounded-lg border border-border bg-background px-3 py-2 font-[family-name:var(--font-mono)] text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="images" className="text-sm font-medium text-foreground">
            Answer image(s) or PDF
          </label>
          <input
            id="images"
            type="file"
            name="images"
            accept="image/*,.pdf"
            multiple
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <p className="text-sm text-muted">Accepts JPG, PNG, HEIC, PDF. Add multiple pages if needed.</p>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Marking…" : "Mark this answer"}
        </Button>
      </form>

      <AnimatePresence>
      {result && !result.ok && (
        <motion.div
          key="error"
          role="alert"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {result.error}
        </motion.div>
      )}

      {result?.ok && (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Total score</p>
              <p className="mt-0.5 text-sm text-muted">{pct}%, {marksAwarded} of {marksAvailable} marks</p>
            </div>
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full border-4 text-lg font-bold ${
                pct >= 80
                  ? "border-success bg-success/10 text-success"
                  : pct >= 50
                    ? "border-highlight bg-highlight/10 text-highlight"
                    : "border-error bg-error/10 text-error"
              }`}
            >
              {marksAwarded}/{marksAvailable}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {result.result.feedback.map((f, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3 ${
                  f.met
                    ? "border-success/30 bg-success/5"
                    : "border-error/30 bg-error/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs font-bold ${
                      f.met ? "bg-success/20 text-success" : "bg-error/20 text-error"
                    }`}
                  >
                    {f.met ? <Check className="size-3" strokeWidth={2.5} /> : <X className="size-3" strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{f.point}</p>
                    <p className="mt-1 text-sm text-muted">{f.comment}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setResult(null)}
          >
            Mark another paper
          </Button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
