"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { animated, useSpring, useTrail } from "@react-spring/web";
import { X, Check, Trophy, PartyPopper, Puzzle, Sparkles, NotebookPen, Lightbulb } from "lucide-react";
import type { LessonSection, LessonInteractive } from "@/lib/ai/lessons";
import { LessonInteractiveWidget } from "@/components/interactives/lesson-interactive";
import { completeLessonAction, adaptNextSectionAction, markOpenAnswerAction } from "@/app/actions/lessons";
import { celebrate, burstAt } from "@/lib/confetti";
import { springs, useReducedMotionSafe } from "@/lib/motion";
import { Button, ButtonLink } from "@/components/button";
import { AiLoading } from "@/components/ai-loading";
import { RichText } from "@/components/rich-text";
import { LessonVisual } from "./lesson-visual";
import { QuickCheck } from "./quick-check";
import { LessonTutor } from "./lesson-tutor";
import {
  type Step,
  buildLessonPlan,
  getCorrectAnswerLabel,
  cardDefinition,
} from "./lesson-plan";
import { ScrollTrigger, ScrollHint, QuitModal } from "./lesson-parts";
import { ReportButton } from "@/components/report-button";

// ── LessonPlayer ───────────────────────────────────────────────────────────
export function LessonPlayer({
  topicId,
  hook,
  interactive,
  sections,
  practiceHref,
  flashcardsHref,
  coachTopicId,
  exitHref = "/dashboard",
  title,
  subtitle,
  mode = "topic",
}: {
  topicId: string;
  hook?: string;
  interactive?: LessonInteractive | null;
  sections: LessonSection[];
  practiceHref?: string;
  flashcardsHref?: string;
  coachTopicId?: string;
  exitHref?: string;
  title?: string;
  subtitle?: string;
  mode?: "topic" | "subtopic";
}) {
  useReducedMotionSafe();
  const router = useRouter();

  // Hide the site navbar while lesson is mounted
  useEffect(() => {
    document.body.classList.add("lesson-mode");
    return () => document.body.classList.remove("lesson-mode");
  }, []);

  // Build the lesson plan once from sections
  const plan = useMemo(
    () => buildLessonPlan(!!interactive, !!hook, sections),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Navigation state ──────────────────────────────────────────────────
  const [planIdx, setPlanIdx] = useState(0);
  const [isDone, setIsDone] = useState(false);

  // ── Per-step state (reset on each navigation) ─────────────────────────
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [exampleRevealed, setExampleRevealed] = useState(false);
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flashcardSeen, setFlashcardSeen] = useState<Set<number>>(new Set());
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [tutorAnswer, setTutorAnswer] = useState("");
  const [tutorFeedback, setTutorFeedback] = useState<{ text: string; marks: number; total: number } | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [flashcardRatings, setFlashcardRatings] = useState<Record<number, "hard" | "good" | "easy">>({});

  // ── Cross-step state ──────────────────────────────────────────────────
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [wrongSections, setWrongSections] = useState<Set<number>>(new Set());
  const [xp, setXp] = useState<number | null>(null);
  const [coachEdits, setCoachEdits] = useState<Record<number, { explanation: string; example: string }>>({});
  const [adaptedSections, setAdaptedSections] = useState<Set<number>>(new Set());
  const [showQuitModal, setShowQuitModal] = useState(false);
  const adaptRequested = useRef<Set<number>>(new Set());

  const step = plan[planIdx] as Step | undefined;
  const displayedSections = sections.map((s, i) => ({ ...s, ...coachEdits[i] }));

  // ── Progress bar ─────────────────────────────────────────────────────
  const progressPct = isDone ? 100 : (planIdx / plan.length) * 100;
  const progressSpring = useSpring({ width: `${progressPct}%`, config: springs.snappy });

  // ── Step key for animation ────────────────────────────────────────────
  const stepKey = isDone ? "done" : `${step?.phase ?? "idle"}-${planIdx}`;

  // ── Handlers ─────────────────────────────────────────────────────────
  // ── Derived context for the AI tutor sidebar ─────────────────────────
  const activeSectionIndex: number | null = (() => {
    if (!step || isDone) return null;
    if (step.phase === "teach" || step.phase === "check" || step.phase === "tutor") return step.sectionIndex;
    if (step.phase === "flashcard") return step.cardIndices[flashcardIdx] ?? step.cardIndices[0] ?? null;
    return null;
  })();
  const currentSection = activeSectionIndex !== null ? displayedSections[activeSectionIndex] : null;
  const tutorContext = currentSection
    ? `${currentSection.heading}\n\n${currentSection.explanation}\n\nExample: ${currentSection.example}`
    : "The student has completed the lesson and may be reviewing it.";

  // ── Keyboard shortcuts (1/2/3 = Hard/Good/Easy on flashcard rating) ───
  useEffect(() => {
    if (!step || step.phase !== "flashcard" || !flashcardFlipped || flashcardRatings[flashcardIdx] !== undefined) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "1") rateCard("hard");
      else if (e.key === "2") rateCard("good");
      else if (e.key === "3") rateCard("easy");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function rateCard(rating: "hard" | "good" | "easy") {
    const cardCount = step?.phase === "flashcard" ? step.cardIndices.length : 0;
    setFlashcardRatings((prev) => ({ ...prev, [flashcardIdx]: rating }));
    setFlashcardSeen((prev) => new Set(prev).add(flashcardIdx));
    if (flashcardIdx < cardCount - 1) {
      setFlashcardIdx((i) => i + 1);
      setFlashcardFlipped(false);
    }
  }

  function resetStepState() {
    setCheckResult(null);
    setHintOpen(false);
    setExampleRevealed(false);
    setFlashcardIdx(0);
    setFlashcardSeen(new Set());
    setFlashcardFlipped(false);
    setTutorAnswer("");
    setTutorFeedback(null);
    setTutorLoading(false);
    setFlashcardRatings({});
  }

  async function finish() {
    setIsDone(true);
    celebrate();
    const result = await completeLessonAction(topicId, mode);
    setXp(result.xp);
  }

  function next() {
    if (step?.phase === "recap") { finish(); return; }
    resetStepState();
    setPlanIdx((p) => p + 1);
  }

  function requestAdaptation(struggledIndex: number) {
    const nextIndex = struggledIndex + 1;
    if (nextIndex >= sections.length || adaptRequested.current.has(nextIndex)) return;
    adaptRequested.current.add(nextIndex);
    const struggled = sections[struggledIndex];
    const nextSec = sections[nextIndex];
    adaptNextSectionAction({
      topicId: coachTopicId ?? topicId,
      struggledConcept: { heading: struggled.heading, explanation: struggled.explanation },
      nextSection: { heading: nextSec.heading, explanation: nextSec.explanation, example: nextSec.example },
    })
      .then((result) => {
        if (!result.adapted) return;
        setCoachEdits((cur) =>
          cur[nextIndex] ? cur : { ...cur, [nextIndex]: { explanation: result.explanation, example: result.example } }
        );
        setAdaptedSections((prev) => new Set(prev).add(nextIndex));
      })
      .catch(() => {});
  }

  async function submitTutorAnswer() {
    if (!step || step.phase !== "tutor" || !tutorAnswer.trim() || tutorLoading) return;
    const sec = displayedSections[step.sectionIndex];
    if (!sec) return;
    setTutorLoading(true);
    try {
      const result = await markOpenAnswerAction({
        topicId: coachTopicId ?? topicId,
        sectionHeading: sec.heading,
        question: sec.check.question,
        explanation: sec.explanation,
        answer: tutorAnswer,
      });
      setTutorFeedback({ text: result.feedback, marks: result.marks, total: result.total });
    } catch {
      setTutorFeedback({ text: "Could not mark your answer right now, continue to the next step.", marks: 2, total: 3 });
    } finally {
      setTutorLoading(false);
    }
  }

  return (
    <>
      {showQuitModal && (
        <QuitModal
          onKeepGoing={() => setShowQuitModal(false)}
          onQuit={() => router.push(exitHref)}
        />
      )}

      {!isDone && <ScrollHint />}

      <div className="flex min-h-dvh flex-col bg-background">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        {!isDone && (
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Quit lesson"
              onClick={() => setShowQuitModal(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-error hover:text-error"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
            <div className="flex-1 overflow-hidden rounded-full bg-surface" style={{ height: 10 }}>
              <animated.div
                style={progressSpring}
                className="h-full rounded-full bg-primary shadow-[0_0_8px_0_var(--primary)]"
              />
            </div>
            <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-muted">
              {planIdx + 1}/{plan.length}
            </span>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="grid w-full flex-1 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div key={stepKey} className="animate-step-in mx-auto w-full max-w-4xl px-2 py-4 sm:px-4 lg:px-10 lg:py-10">

            {/* ── Interactive pre-lesson widget ───────────────────────── */}
            {!isDone && step?.phase === "interactive" && interactive && (
              <div className="w-full px-4 py-8 sm:px-6">
                <LessonInteractiveWidget interactive={interactive} onContinue={next} />
              </div>
            )}

            {/* ── Hook screen ─────────────────────────────────────────── */}
            {!isDone && step?.phase === "hook" && (
              <div className="w-full px-4 py-16 sm:px-6">
                <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Puzzle className="size-8" strokeWidth={1.75} />
                  </div>
                  {title && (
                    <div>
                      {subtitle && (
                        <p className="text-sm text-muted">{subtitle}</p>
                      )}
                      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground sm:text-4xl">
                        {title}
                      </h1>
                    </div>
                  )}
                  <p className="max-w-md text-lg leading-snug text-foreground">{hook}</p>
                  <p className="text-sm text-muted">
                    {sections.length} concepts · ~{Math.ceil(sections.length * 1.5)} min
                  </p>
                  <ScrollTrigger onReached={next}>
                    <Button onClick={next} className="mt-2 px-8">Let&apos;s go →</Button>
                  </ScrollTrigger>
                </div>
              </div>
            )}

            {/* ── Teach slide ─────────────────────────────────────────── */}
            {!isDone && step?.phase === "teach" && (() => {
              const sec = displayedSections[step.sectionIndex];
              if (!sec) return null;
              const hasVisual = !!sec.visual;
              return (
                <div className="w-full px-4 py-8 sm:px-6">
                  <div className="mb-6 flex items-center gap-3">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {sec.heading}
                    </span>
                    {adaptedSections.has(step.sectionIndex) && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <Sparkles className="size-3.5" strokeWidth={2} /> Adapted to your progress
                      </span>
                    )}
                  </div>

                  <div className={`grid gap-8 ${hasVisual ? "lg:grid-cols-2 lg:items-start" : ""}`}>
                    {/* Left: explanation + example reveal */}
                    <div>
                      <p className="max-w-[65ch] text-lg leading-relaxed text-foreground">
                        <RichText text={sec.explanation} />
                      </p>

                      {!exampleRevealed ? (
                        <button
                          type="button"
                          onClick={() => setExampleRevealed(true)}
                          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          <NotebookPen className="size-4" strokeWidth={2} /> See a worked example →
                        </button>
                      ) : (
                        <div className="mt-6 animate-fade-slide-up rounded-xl border border-border bg-surface p-5">
                          <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                            Worked example
                          </h3>
                          <p className="max-w-[65ch] text-base leading-relaxed text-foreground">
                            <RichText text={sec.example} />
                          </p>
                        </div>
                      )}

                      {exampleRevealed && (
                        <div className="mt-6 animate-fade-slide-up">
                          <ScrollTrigger onReached={next}>
                            <Button onClick={next} className="px-8">Got it, test me →</Button>
                          </ScrollTrigger>
                        </div>
                      )}
                    </div>

                    {/* Right: visual (large screens) */}
                    {hasVisual && (
                      // bg-background, not bg-surface — most AI-generated
                      // SVGs fill their own shapes with var(--color-surface)
                      // (a "card"/"node" look), which is invisible against a
                      // wrapper using that exact same token.
                      <div className="rounded-xl border border-border bg-background p-4">
                        <LessonVisual visual={sec.visual!} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Check slide ─────────────────────────────────────────── */}
            {!isDone && step?.phase === "check" && (() => {
              const sec = displayedSections[step.sectionIndex];
              if (!sec) return null;
              return (
                <div className="w-full px-4 py-8 sm:px-6">
                  <div className="overflow-hidden rounded-2xl">
                    <div className="flex flex-col gap-6 pb-6">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {sec.heading}
                        </span>
                        {adaptedSections.has(step.sectionIndex) && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                            <Sparkles className="size-3.5" strokeWidth={2} /> Adapted
                          </span>
                        )}
                      </div>

                      <p className="font-[family-name:var(--font-display)] text-2xl leading-snug text-foreground">
                        <RichText text={sec.check.question} />
                      </p>

                      {checkResult === null && !hintOpen && (
                        <button
                          type="button"
                          onClick={() => setHintOpen(true)}
                          className="inline-flex items-center gap-1 self-start text-xs text-muted underline underline-offset-2 hover:text-foreground"
                        >
                          <Lightbulb className="size-3.5" strokeWidth={2} /> Not sure? See a hint
                        </button>
                      )}
                      {hintOpen && checkResult === null && (
                        <div className="animate-fade-slide-up rounded-lg border border-border bg-background p-3 text-sm text-muted">
                          <RichText text={sec.explanation} />
                        </div>
                      )}

                      <QuickCheck
                        key={`check-${step.sectionIndex}`}
                        check={sec.check}
                        revealed={checkResult !== null}
                        onResult={(correct, el) => {
                          setCheckResult(correct);
                          const firstTry = !answered.has(step.sectionIndex);
                          setAnswered((prev) => new Set(prev).add(step.sectionIndex));
                          if (correct) {
                            if (firstTry) setCorrectCount((c) => c + 1);
                            const rect = el.getBoundingClientRect();
                            burstAt(
                              (rect.left + rect.width / 2) / window.innerWidth,
                              (rect.top + rect.height / 2) / window.innerHeight
                            );
                          } else if (firstTry) {
                            setWrongSections((prev) => new Set(prev).add(step.sectionIndex));
                            requestAdaptation(step.sectionIndex);
                          }
                        }}
                      />
                    </div>

                    {/* Result panel */}
                    {checkResult !== null && (
                      <div
                        className={`animate-fade-slide-up border-t-2 p-5 ${
                          checkResult ? "border-success/40 bg-success/10" : "border-error/40 bg-error/10"
                        }`}
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              checkResult ? "bg-success text-white" : "bg-error text-white"
                            }`}
                          >
                            {checkResult ? (
                              <Check className="size-4" strokeWidth={2.5} />
                            ) : (
                              <X className="size-4" strokeWidth={2.5} />
                            )}
                          </span>
                          <span className={`text-sm font-semibold ${checkResult ? "text-success" : "text-error"}`}>
                            {checkResult ? "Correct!" : `Answer: ${getCorrectAnswerLabel(sec.check)}`}
                          </span>
                        </div>
                        {(() => {
                          const pos = sec.visualPosition ?? "middle";
                          const vis = sec.visual ? (
                            <div className="mb-3"><LessonVisual visual={sec.visual} /></div>
                          ) : null;
                          return (
                            <>
                              {pos === "top" && vis}
                              <p className="mb-3 text-sm text-foreground">
                                <RichText text={sec.explanation} />
                              </p>
                              {pos === "middle" && vis}
                              <p className="mb-4 text-sm text-muted">
                                <RichText text={sec.example} />
                              </p>
                              {pos === "bottom" && vis}
                            </>
                          );
                        })()}
                        <ScrollTrigger onReached={next}>
                          <Button onClick={next} className="w-full justify-center">Continue →</Button>
                        </ScrollTrigger>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Flashcard slide ─────────────────────────────────────── */}
            {!isDone && step?.phase === "flashcard" && (() => {
              const cards = step.cardIndices.map((i) => ({
                term: displayedSections[i].heading,
                def: cardDefinition(displayedSections[i].explanation),
              }));
              const card = cards[flashcardIdx];
              const allRated = Object.keys(flashcardRatings).length >= cards.length;
              const currentRating = flashcardRatings[flashcardIdx];
              return (
                <div className="w-full px-4 py-8 sm:px-6">
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-sm font-medium text-muted">Vocabulary check</p>
                    <div className="flex items-center gap-2">
                      {cards.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: flashcardRatings[i] === "easy"
                              ? "var(--success)"
                              : flashcardRatings[i] === "good"
                                ? "var(--primary)"
                                : flashcardRatings[i] === "hard"
                                  ? "var(--error)"
                                  : i === flashcardIdx
                                    ? "color-mix(in srgb, var(--primary) 50%, transparent)"
                                    : "var(--border)",
                          }}
                        />
                      ))}
                    </div>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-muted">
                      {flashcardIdx + 1}/{cards.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!flashcardFlipped) {
                        setFlashcardFlipped(true);
                        setFlashcardSeen((prev) => new Set(prev).add(flashcardIdx));
                      }
                    }}
                    disabled={flashcardFlipped}
                    className="w-full disabled:cursor-default"
                  >
                    <div
                      className={`flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 p-8 text-center transition-colors ${
                        flashcardFlipped
                          ? "border-primary bg-primary/5"
                          : "border-border bg-surface hover:border-primary/40"
                      }`}
                    >
                      {!flashcardFlipped ? (
                        <>
                          <p className="text-2xl font-semibold text-foreground">{card.term}</p>
                          <p className="mt-3 text-sm text-muted">Tap to reveal definition</p>
                        </>
                      ) : (
                        <>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{card.term}</p>
                          <p className="text-base leading-relaxed text-foreground">
                            <RichText text={card.def} />
                          </p>
                        </>
                      )}
                    </div>
                  </button>

                  {/* How well did you know this? */}
                  {flashcardFlipped && !currentRating && (
                    <div className="mt-4 animate-fade-slide-up">
                      <p className="mb-2 text-center text-sm text-muted">How well did you know this?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => rateCard("hard")}
                          aria-label="Hard, see again soon"
                          className="flex-1 rounded-xl border-2 border-error/30 bg-error/10 px-3 py-3 text-center transition-colors hover:bg-error/20"
                        >
                          <p className="text-sm font-semibold text-error">Hard</p>
                          <p className="mt-0.5 text-xs text-muted">see again soon</p>
                          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-muted">1</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => rateCard("good")}
                          aria-label="Good, see again in about a day"
                          className="flex-1 rounded-xl border-2 border-primary/30 bg-primary/10 px-3 py-3 text-center transition-colors hover:bg-primary/20"
                        >
                          <p className="text-sm font-semibold text-primary">Good</p>
                          <p className="mt-0.5 text-xs text-muted">~1 day</p>
                          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-muted">2</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => rateCard("easy")}
                          aria-label="Easy, learned"
                          className="flex-1 rounded-xl border-2 border-success/30 bg-success/10 px-3 py-3 text-center transition-colors hover:bg-success/20"
                        >
                          <p className="text-sm font-semibold text-success">Easy</p>
                          <p className="mt-0.5 text-xs text-muted">learned</p>
                          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-muted">3</p>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Navigation / continue */}
                  {(currentRating || !flashcardFlipped) && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => { setFlashcardIdx((i) => Math.max(0, i - 1)); setFlashcardFlipped(false); }}
                        disabled={flashcardIdx === 0}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors disabled:opacity-30 hover:border-primary hover:text-foreground"
                      >
                        ← Back
                      </button>
                      {allRated ? (
                        <ScrollTrigger onReached={next}>
                          <Button onClick={next} className="px-6">Continue →</Button>
                        </ScrollTrigger>
                      ) : flashcardIdx < cards.length - 1 && currentRating ? (
                        <button
                          type="button"
                          onClick={() => { setFlashcardIdx((i) => i + 1); setFlashcardFlipped(false); }}
                          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-foreground"
                        >
                          Next →
                        </button>
                      ) : (
                        <span className="text-sm text-muted">{currentRating ? "Rate all cards to continue" : "Tap the card, then rate it"}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tutor slide ─────────────────────────────────────────── */}
            {!isDone && step?.phase === "tutor" && (() => {
              const sec = displayedSections[step.sectionIndex];
              if (!sec) return null;
              const marksColor = tutorFeedback
                ? tutorFeedback.marks === tutorFeedback.total
                  ? "text-success"
                  : tutorFeedback.marks >= Math.ceil(tutorFeedback.total / 2)
                    ? "text-highlight"
                    : "text-error"
                : "";
              return (
                <div className="w-full px-4 py-8 sm:px-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                      Open practice
                    </h2>
                    <span className="rounded-full border border-border px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-muted">
                      3 marks
                    </span>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                    {/* Question + context */}
                    <div className="rounded-2xl border border-border bg-surface p-6">
                      <p className="mb-4 text-base font-medium text-foreground">
                        <RichText text={sec.check.question} />
                      </p>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="mb-1 text-sm font-semibold text-foreground">
                          Context
                        </p>
                        <p className="text-sm leading-relaxed text-muted">
                          <RichText text={sec.explanation} />
                        </p>
                      </div>
                    </div>

                    {/* Answer area */}
                    <div>
                      <textarea
                        value={tutorAnswer}
                        onChange={(e) => setTutorAnswer(e.target.value)}
                        disabled={!!tutorFeedback}
                        rows={6}
                        placeholder="Write your full answer here, showing your reasoning…"
                        className="w-full resize-none rounded-xl border border-border bg-surface p-4 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none disabled:opacity-60"
                      />

                      {!tutorFeedback && (
                        <Button
                          onClick={submitTutorAnswer}
                          disabled={!tutorAnswer.trim() || tutorLoading}
                          className="mt-3 w-full justify-center"
                        >
                          {tutorLoading ? "Marking…" : "Mark my answer →"}
                        </Button>
                      )}

                      {tutorLoading && (
                        <AiLoading
                          overlay
                          title="Marking your answer"
                          messages={[
                            "Reading what you wrote…",
                            "Checking it against the markscheme…",
                            "Working out where you earned marks…",
                            "Writing feedback…",
                          ]}
                        />
                      )}

                      {tutorFeedback && (
                        <div className="mt-4 animate-fade-slide-up rounded-xl border border-border bg-surface p-5">
                          <div className="mb-3 flex items-center gap-2">
                            <span className={`font-[family-name:var(--font-mono)] text-2xl font-bold ${marksColor}`}>
                              {tutorFeedback.marks}/{tutorFeedback.total}
                            </span>
                            <span className="text-xs text-muted">marks</span>
                          </div>
                          <p className="text-sm leading-relaxed text-foreground">{tutorFeedback.text}</p>
                          <ScrollTrigger onReached={next}>
                            <Button onClick={next} className="mt-5 w-full justify-center">Continue →</Button>
                          </ScrollTrigger>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Recap slide ─────────────────────────────────────────── */}
            {!isDone && step?.phase === "recap" && (
              <div className="w-full px-4 py-8 sm:px-6">
                <h2 className="mb-6 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
                  Recap
                </h2>
                <div className="grid gap-8 lg:grid-cols-2">
                  {/* Key takeaways */}
                  <div>
                    <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                      Key takeaways
                    </h3>
                    <ul className="flex flex-col gap-3">
                      {sections.map((sec) => (
                        <li
                          key={sec.heading}
                          className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                            <Check className="size-3" strokeWidth={2.5} />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{sec.heading}</p>
                            <p className="mt-0.5 text-sm text-muted">{cardDefinition(sec.explanation)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Score + actions */}
                  <div className="flex flex-col gap-5">
                    <div>
                      <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                      Your score
                    </h3>
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                        <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-foreground">
                          {correctCount}/{sections.length}
                        </p>
                        <p className="text-sm text-muted">questions correct on first try</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                      Continue with
                    </h3>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={practiceHref ?? `/practice/${topicId}`}
                          className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary"
                        >
                          Practice exam questions <span className="text-primary">→</span>
                        </Link>
                        <Link
                          href={flashcardsHref ?? `/flashcards/${topicId}`}
                          className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary"
                        >
                          Flashcards <span className="text-primary">→</span>
                        </Link>
                      </div>
                    </div>

                    <ScrollTrigger onReached={next}>
                      <Button onClick={next} className="mt-auto w-full justify-center">
                        Complete lesson →
                      </Button>
                    </ScrollTrigger>
                  </div>
                </div>
              </div>
            )}

            {/* ── Done screen ─────────────────────────────────────────── */}
            {isDone && (
              <div className="w-full px-4 py-16 sm:px-6">
                <DoneCard
                  practiceHref={practiceHref ?? `/practice/${topicId}`}
                  flashcardsHref={flashcardsHref ?? `/flashcards/${topicId}`}
                  exitHref={exitHref}
                  correctCount={correctCount}
                  total={sections.length}
                  xp={xp}
                />
              </div>
            )}
          </div>

          {/* ── AI tutor sidebar ──────────────────────────────────── */}
          {!isDone && (
            <div className="flex flex-col gap-4 lg:sticky lg:top-[var(--lesson-bar,3.5rem)] lg:h-[calc(100dvh-var(--lesson-bar,3.5rem))] lg:border-l lg:border-border lg:bg-surface/40 lg:p-6">
              <LessonTutor key={stepKey} topicId={coachTopicId ?? topicId} context={tutorContext} />
              <div className="px-1">
                <ReportButton
                  contextLabel={`Lesson: ${title ?? topicId}`}
                  topicId={mode === "topic" ? topicId : undefined}
                  subtopicId={mode === "subtopic" ? topicId : undefined}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── DoneCard ───────────────────────────────────────────────────────────────
function DoneCard({
  practiceHref,
  flashcardsHref,
  exitHref,
  correctCount,
  total,
  xp,
}: {
  practiceHref: string;
  flashcardsHref: string;
  exitHref: string;
  correctCount: number;
  total: number;
  xp: number | null;
}) {
  const trail = useTrail(3, {
    from: { opacity: 0, y: 16, scale: 0.95 },
    to: { opacity: 1, y: 0, scale: 1 },
    config: springs.gentle,
  });

  const xpSpring = useSpring({
    n: xp !== null ? 20 : 0,
    config: { tension: 60, friction: 20 },
  });

  const perfect = correctCount === total;

  return (
    <div
      className={`flex flex-col items-center gap-5 rounded-2xl border p-8 text-center ${
        perfect ? "border-highlight/40 bg-highlight/10" : "border-success/30 bg-success/10"
      }`}
    >
      <animated.div
        style={trail[0]}
        className={`flex size-16 items-center justify-center rounded-full ${
          perfect ? "bg-highlight/15 text-highlight" : "bg-success/15 text-success"
        }`}
      >
        {perfect ? (
          <Trophy className="size-9" strokeWidth={1.75} />
        ) : (
          <PartyPopper className="size-9" strokeWidth={1.75} />
        )}
      </animated.div>

      <animated.p
        style={trail[0]}
        className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground"
      >
        {perfect ? "Perfect score!" : "Lesson complete!"}
      </animated.p>

      <animated.div style={trail[1]} className="flex items-center gap-4">
        <div className="rounded-xl border border-border bg-surface px-4 py-2 text-center">
          <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-foreground">
            {correctCount}/{total}
          </p>
          <p className="text-xs text-muted">correct</p>
        </div>
        {xp !== null && (
          <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-center">
            <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-highlight">
              +<animated.span>{xpSpring.n.to((v) => Math.round(v))}</animated.span>
            </p>
            <p className="text-xs text-muted">XP earned</p>
          </div>
        )}
      </animated.div>

      <animated.div style={trail[2]} className="flex w-full flex-col items-center gap-3">
        <ButtonLink href={practiceHref} className="w-full justify-center">
          Practice a real exam question →
        </ButtonLink>
        <div className="flex gap-3">
          <ButtonLink href={flashcardsHref} variant="secondary" className="!shadow-none">
            Flashcards
          </ButtonLink>
          <Link
            href={exitHref}
            className="inline-flex items-center px-4 py-3 text-sm font-medium text-muted hover:text-foreground"
          >
            Dashboard
          </Link>
        </div>
      </animated.div>
    </div>
  );
}
