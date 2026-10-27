"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import { checkTransferAction } from "@/app/actions/practice";
import { Button } from "@/components/button";
import { RichText } from "@/components/rich-text";
import { LessonScene } from "@/components/lesson-scene";
import { Banner } from "@/components/question-feedback";
import { EASE_OUT } from "@/components/motion";
import type { Scene } from "@/lib/lesson-scene";
import type { TransferCheck } from "@/lib/question-remediation";

const PAUSE_MS = 4000;

type Stage = "explain" | "pause" | "check";

function ZoomableScene({ scene }: { scene: Scene }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <LessonScene scene={scene} />
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 text-sm font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Maximize2 className="size-4" strokeWidth={2} aria-hidden /> Enlarge diagram
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Enlarged diagram"
        className="m-auto w-[min(60rem,95vw)] rounded-2xl border border-border bg-background p-4 text-foreground backdrop:bg-black/60"
      >
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="mb-2 ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-xl text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close enlarged diagram"
        >
          <X className="size-5" strokeWidth={2} aria-hidden />
        </button>
        <LessonScene scene={scene} />
      </dialog>
    </div>
  );
}

// Conceptual remediation: read the explanation, pause to reflect, then a
// transfer check on the same idea in a different form.
export function ExplainRemediation({
  questionId,
  content,
  scene,
  transferCheck,
  onPassed,
}: {
  questionId: string;
  content: string;
  scene?: Scene | null;
  transferCheck: TransferCheck;
  onPassed: () => void;
}) {
  const reduce = !!useReducedMotion();
  const [stage, setStage] = useState<Stage>("explain");
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (stage !== "pause") return;
    const t = setTimeout(() => setStage("check"), PAUSE_MS);
    return () => clearTimeout(t);
  }, [stage]);

  // Move focus to the heading of whichever stage just appeared.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stage]);

  const answer = transferCheck.kind === "mcq" ? (choice === null ? "" : String(choice)) : text.trim();

  async function check() {
    if (!answer || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await checkTransferAction({ questionId, answer });
      if (res.correct) {
        setPassed(true);
        onPassed();
      } else {
        setFailed(true);
        setChoice(null);
        setText("");
        setStage("explain");
      }
    } catch {
      setError("Couldn't check that. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  const headingClass =
    "font-[family-name:var(--font-display)] text-xl font-semibold text-foreground outline-none";

  return (
    <MotionConfig reducedMotion="user">
      <section className="flex flex-col gap-4">
        <div aria-live="polite">
          {failed && stage === "explain" && <Banner tone="error">Not quite, have another look</Banner>}
          {passed && <Banner tone="success">You worked it out</Banner>}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {stage === "explain" && (
            <motion.div
              key="explain"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-col gap-4"
            >
              <h3 ref={headingRef} tabIndex={-1} className={headingClass}>
                Let&apos;s learn it
              </h3>
              <div className="text-base leading-relaxed text-foreground">
                <RichText text={content} />
              </div>
              {scene && <ZoomableScene scene={scene} />}
              <Button type="button" className="min-h-11 self-start" onClick={() => setStage("pause")}>
                Okay, I&apos;ve got it
              </Button>
            </motion.div>
          )}

          {stage === "pause" && (
            <motion.div
              key="pause"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-col items-start gap-4 py-4"
            >
              <h3 ref={headingRef} tabIndex={-1} className={headingClass}>
                Think about what you&apos;ve learnt…
              </h3>
              {!reduce && (
                <div aria-hidden className="flex items-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-3 rounded-full bg-primary"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              )}
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => setStage("explain")}>
                Show me the support again
              </Button>
            </motion.div>
          )}

          {stage === "check" && (
            <motion.div
              key="check"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-col gap-4"
            >
              <h3 ref={headingRef} tabIndex={-1} className={headingClass}>
                Check your learning
              </h3>
              <p className="text-base text-foreground">
                <RichText text={transferCheck.prompt} />
              </p>

              {transferCheck.kind === "mcq" ? (
                <div role="group" aria-label="Answer options" className="flex flex-col gap-2">
                  {(transferCheck.options ?? []).map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={choice === i}
                      disabled={checking || passed}
                      onClick={() => setChoice(i)}
                      className={`min-h-11 rounded-2xl border px-4 py-3 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        choice === i
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-surface text-foreground hover:border-primary/50"
                      }`}
                    >
                      <RichText text={opt} />
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  aria-label="Your answer"
                  autoComplete="off"
                  value={text}
                  disabled={checking || passed}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void check();
                    }
                  }}
                  className="min-h-11 w-full max-w-md rounded-2xl border border-border bg-surface px-4 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              )}

              {error && <p className="text-base text-error-ink">{error}</p>}
              <Button
                type="button"
                className="min-h-11 self-start"
                onClick={check}
                disabled={!answer || checking || passed}
              >
                {checking ? "Checking…" : "Check"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}
