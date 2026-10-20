"use client";

import { AnswerFeedback, FeedbackDetailText } from "./answer-feedback";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { animated, useTrail } from "@react-spring/web";
import { X, Check, Trophy, PartyPopper, Puzzle, Sparkles, NotebookPen } from "lucide-react";
import type { LessonSection, LessonInteractive } from "@/lib/ai/lessons";
import { LessonInteractiveWidget } from "@/components/interactives/lesson-interactive";
import { completeLessonAction, adaptNextSectionAction, markOpenAnswerAction, recordCheckResultAction, type LessonCompletion } from "@/app/actions/lessons";
import { CountUp } from "@/components/results-motion";
import { celebrate, burstAt } from "@/lib/confetti";
import { springs, useReducedMotionSafe } from "@/lib/motion";
import { Button, ButtonLink } from "@/components/button";
import { AiLoading } from "@/components/ai-loading";
import { RichText } from "@/components/rich-text";
import { LessonVisual } from "./lesson-visual";
import { WorkedExample } from "./worked-example";
import { builtinSceneFor } from "@/lib/builtin-scenes";
import { resolveExampleSteps } from "@/lib/worked-example";
import { QuickCheck } from "./quick-check";
import { attemptSeed } from "@/lib/shuffle";
import { LessonTutor } from "./lesson-tutor";
import type { CoachSession } from "@/lib/lesson-coach-context";
import { LessonPracticeStep } from "./lesson-practice";
import type { LessonPractice } from "@/lib/lesson-personalise";
import {
  type Step,
  buildLessonPlan,
  getCorrectAnswerLabel,
  cardDefinition,
  vocabCardForSection,
  stageForStep,
  stepLabel,
  stepInstruction,
  primaryHint,
  disabledReason,
  isFirstOfPhase,
  recapSoFar,
  takeawayFor,
  clampStep,
  tryState,
  tryStateLabel,
  afterCheckText,
  missHint,
  canRetry,
} from "./lesson-plan";
import { QuitModal, WatchLabel, YourTurnBanner } from "./lesson-parts";
import { LessonHeader } from "./lesson-header";
import { RecapPanel, TakeawayChip } from "./lesson-recap";
import { ReportButton } from "@/components/report-button";

// ── LessonPlayer ───────────────────────────────────────────────────────────
export function LessonPlayer({
  topicId,
  hook,
  interactive,
  sections,
  practice,
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
  practice?: LessonPractice | null;
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

  // Coach panel: remembered per device on desktop; on phones it is a sheet
  // that always starts closed.
  useEffect(() => {
    try {
      if (window.matchMedia("(min-width: 1024px)").matches && localStorage.getItem("lesson-coach-open") === "1") setHelpOpen(true);
    } catch {}
  }, []);
  function setCoachOpen(open: boolean) {
    setHelpOpen(open);
    try {
      if (window.matchMedia("(min-width: 1024px)").matches) localStorage.setItem("lesson-coach-open", open ? "1" : "0");
    } catch {}
  }

  // Hide the site navbar while lesson is mounted
  useEffect(() => {
    document.body.classList.add("lesson-mode");
    return () => document.body.classList.remove("lesson-mode");
  }, []);

  // Build the lesson plan once from sections
  const plan = useMemo(
    () => buildLessonPlan(!!interactive, !!hook, sections, { interactiveKind: interactive?.kind ?? null, hasPractice: !!practice?.items.length }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Navigation state ──────────────────────────────────────────────────
  const [planIdx, setPlanIdx] = useState(0);
  const [isDone, setIsDone] = useState(false);

  // ── Per-step state (reset on each navigation) ─────────────────────────
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
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
  const [completion, setCompletion] = useState<LessonCompletion | null>(null);
  const [coachEdits, setCoachEdits] = useState<Record<number, { explanation: string; example: string }>>({});
  const [adaptedSections, setAdaptedSections] = useState<Set<number>>(new Set());
  const [showQuitModal, setShowQuitModal] = useState(false);
  const adaptRequested = useRef<Set<number>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false); // coach panel open
  const [hasDraft, setHasDraft] = useState(false);
  const [misses, setMisses] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Bumps on every navigation so a revisited check gets a fresh option order.
  const [visit, setVisit] = useState(0);
  const [recapOpen, setRecapOpen] = useState(false);
  const [maxVisited, setMaxVisited] = useState(0);
  // Small record the coach uses to know how this student is getting on.
  const [coachSession, setCoachSession] = useState<CoachSession>({ answers: [], hints: 0, revisits: 0 });
  // Answers per step, so Back and forward again never loses work.
  const memory = useRef<Record<number, StepMemory>>({});
  const stepRef = useRef<HTMLDivElement>(null);

  const step = plan[planIdx] as Step | undefined;
  const displayedSections = sections.map((s, i) => ({ ...s, ...coachEdits[i] }));

  // ── Progress bar ─────────────────────────────────────────────────────

  // ── Step key for animation ────────────────────────────────────────────
  const stepKey = isDone ? "done" : `${step?.phase ?? "idle"}-${planIdx}`;
  const recapItems = recapSoFar(plan, planIdx, sections);
  const showHint = isFirstOfPhase(plan, planIdx);

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

  function snapshot(): StepMemory {
    return { checkResult, exampleRevealed, tutorAnswer, tutorFeedback, flashcardRatings, flashcardIdx, flashcardSeen };
  }

  function goTo(target: number) {
    const idx = clampStep(target, plan.length);
    memory.current[planIdx] = snapshot();
    resetStepState();
    const saved = memory.current[idx];
    if (saved) {
      setCheckResult(saved.checkResult);
      setExampleRevealed(saved.exampleRevealed);
      setTutorAnswer(saved.tutorAnswer);
      setTutorFeedback(saved.tutorFeedback);
      setFlashcardRatings(saved.flashcardRatings);
      setFlashcardIdx(saved.flashcardIdx);
      setFlashcardSeen(saved.flashcardSeen);
    }
    try {
      if (!window.matchMedia("(min-width: 1024px)").matches) setHelpOpen(false);
    } catch {}
    setRecapOpen(false);
    if (idx < planIdx) setCoachSession((c) => ({ ...c, revisits: c.revisits + 1 }));
    setVisit((v) => v + 1);
    setPlanIdx(idx);
    setMaxVisited((m) => Math.max(m, idx));
  }

  function back() {
    if (planIdx > 0) goTo(planIdx - 1);
  }

  // Arrow keys: Left goes back; Right only re-visits steps already seen, so a
  // question can never be skipped by accident.
  useEffect(() => {
    if (isDone || showQuitModal) return;
    function onArrow(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft" && planIdx > 0) { e.preventDefault(); goTo(planIdx - 1); }
      else if (e.key === "ArrowRight" && planIdx < maxVisited) { e.preventDefault(); goTo(planIdx + 1); }
    }
    window.addEventListener("keydown", onArrow);
    return () => window.removeEventListener("keydown", onArrow);
  });

  // New step: move focus to it and scroll to the top so screen readers and
  // keyboard users start from the beginning of the new content.
  useEffect(() => {
    stepRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [planIdx, isDone]);

  function resetStepState() {
    setCheckResult(null);
    setHasDraft(false);
    setMisses(0);
    setShowAnswer(false);
    setAttempt(0);
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
    const result = await completeLessonAction(topicId, mode, {
      firstTryCorrect: correctCount,
      checksTotal: sections.length,
      hintsUsed: coachSession.hints,
    });
    setCompletion(result);
  }

  function next() {
    if (step?.phase === "recap") { finish(); return; }
    goTo(planIdx + 1);
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

      <div className="flex min-h-dvh flex-col bg-background">

        {!isDone && step && (
          <LessonHeader
            title={title ?? "Lesson"}
            index={planIdx}
            total={plan.length}
            stage={stageForStep(step, exampleRevealed)}
            canGoBack={planIdx > 0}
            helpOpen={helpOpen}
            recapOpen={recapOpen}
            recapCount={recapItems.length}
            onBack={back}
            onQuit={() => setShowQuitModal(true)}
            onToggleHelp={() => { setCoachOpen(!helpOpen); setRecapOpen(false); }}
            onToggleRecap={() => { setRecapOpen((o) => !o); setHelpOpen(false); }}
          />
        )}
        {!isDone && recapOpen && <RecapPanel items={recapItems} />}
        <p className="sr-only" aria-live="polite" role="status">
          {isDone ? "Lesson complete" : step ? `${stepLabel(planIdx, plan.length)}. ${stageForStep(step, exampleRevealed)}.` : ""}
        </p>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className={`grid w-full flex-1 ${!isDone && helpOpen ? "lg:grid-cols-[minmax(0,1fr)_21.25rem]" : "lg:grid-cols-[minmax(0,1fr)_3.25rem]"}`}>
          <div key={stepKey} ref={stepRef} tabIndex={-1} className="animate-step-in mx-auto outline-none w-full max-w-6xl px-2 py-4 sm:px-4 lg:px-10 lg:py-10">

            {/* ── Interactive: explanation (slider) or post-teaching activity ── */}
            {!isDone && step?.phase === "interactive" && interactive && (
              <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
                <Instruction>{stepInstruction(step)}</Instruction>
                <LessonInteractiveWidget interactive={interactive} onContinue={next} role={step.role ?? "consolidate"} />
              </div>
            )}

            {/* ── Personalised practice, after the teaching ───────────── */}
            {!isDone && step?.phase === "practice" && practice && (
              <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
                <LessonPracticeStep practice={practice} instruction={stepInstruction(step)} onDone={next} />
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
                  <PrimaryAction label="Start the lesson" onClick={next} />
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

                  <Instruction>{stepInstruction(step, sec)}</Instruction>
                  <div className={`grid gap-6 ${hasVisual ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-10" : ""}`}>
                    {/* Left: explanation + example reveal */}
                    <div>
                      <p className="mt-0 max-w-[65ch] text-lg leading-relaxed text-foreground">
                        <RichText text={sec.explanation} />
                      </p>

                      {!exampleRevealed ? (
                        <div className="mt-6">
                          <PrimaryAction
                            label="Show me how"
                            icon={<NotebookPen className="size-4" strokeWidth={2} />}
                            onClick={() => setExampleRevealed(true)}
                            hint={showHint ? "This shows a worked example. Then you can move on." : undefined}
                          />
                        </div>
                      ) : (
                        <div className="mt-6">
                          <WorkedExample
                            key={step.sectionIndex}
                            steps={resolveExampleSteps(sec)}
                            visual={sec.exampleVisual}
                            scene={sec.exampleScene ?? (sec.exampleVisual ? null : builtinSceneFor(sec.heading, sec.explanation))}
                          />
                        </div>
                      )}

                      {exampleRevealed && (
                        <div className="mt-6 flex animate-fade-slide-up flex-col gap-4">
                          <TakeawayChip line={takeawayFor(sec).line} />
                          <PrimaryAction
                            label="Got it, next"
                            onClick={next}
                            hint={showHint ? primaryHint(step, sec) : "Next: a quick question on this."}
                          />
                        </div>
                      )}
                    </div>

                    {/* Visual: stacked first on mobile, right column top-aligned on desktop.
                        The figure brings its own white panel (lesson-figure). */}
                    {hasVisual && (
                      <div className="order-first min-w-0 lg:order-none">
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
              const state = tryState(hasDraft, checkResult);
              const answerVisible = checkResult === true || (checkResult === false && (showAnswer || !canRetry(misses)));
              const retryOffered = checkResult === false && !answerVisible;
              return (
                <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                  <div className="overflow-hidden rounded-2xl">
                    <div className="flex flex-col gap-6 pb-6">
                      <YourTurnBanner
                        instruction={stepInstruction(step, sec)}
                        status={tryStateLabel(state)}
                        next={afterCheckText(state, sec.check.kind === undefined || sec.check.kind === "mcq")}
                      />
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

                      <p className="font-[family-name:var(--font-display)] text-2xl leading-snug text-foreground sm:text-3xl">
                        <RichText text={sec.check.question} />
                      </p>

                      <QuickCheck
                        key={`check-${step.sectionIndex}-${attempt}-${visit}`}
                        seed={attemptSeed(topicId, step.sectionIndex, attempt, visit)}
                        check={sec.check}
                        revealed={answerVisible}
                        onDraft={setHasDraft}
                        onResult={(correct, el, picked) => {
                          setCheckResult(correct);
                          setCoachSession((c) => {
                            const prior = c.answers.filter((a) => a.section === step.sectionIndex);
                            return { ...c, answers: [...c.answers.filter((a) => a.section !== step.sectionIndex), { section: step.sectionIndex, correct, picked: picked ?? prior[0]?.picked, tries: (prior[0]?.tries ?? 0) + 1 }].slice(-40) };
                          });
                          const firstTry = !answered.has(step.sectionIndex);
                          if (firstTry) void recordCheckResultAction({ id: topicId, mode, section: step.sectionIndex, correct }).catch(() => {});
                          setAnswered((prev) => new Set(prev).add(step.sectionIndex));
                          if (correct) {
                            if (firstTry) setCorrectCount((c) => c + 1);
                            const rect = el.getBoundingClientRect();
                            burstAt(
                              (rect.left + rect.width / 2) / window.innerWidth,
                              (rect.top + rect.height / 2) / window.innerHeight
                            );
                          } else {
                            setMisses((m) => m + 1);
                          }
                          if (!correct && firstTry) {
                            setWrongSections((prev) => new Set(prev).add(step.sectionIndex));
                            requestAdaptation(step.sectionIndex);
                          }
                        }}
                      />
                    </div>

                    {retryOffered && (
                      <div className="animate-fade-slide-up border-t-2 border-error/40 bg-error/10 p-5" role="group" aria-label="Not yet">
                        <p className="mb-1 inline-flex items-center gap-2 text-base font-semibold text-error">
                          <X className="size-4" strokeWidth={2.5} /> Not yet. You can try again.
                        </p>
                        <p className="mb-4 text-base text-foreground"><RichText text={missHint(sec)} /></p>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="min-h-12 px-8"
                            onClick={() => { setCheckResult(null); setHasDraft(false); setAttempt((n) => n + 1); }}
                          >
                            Try again
                          </Button>
                          <Button variant="secondary" className="min-h-12 px-6" onClick={() => setShowAnswer(true)}>
                            Show the answer
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Result panel */}
                    {answerVisible && (() => {
                      const pos = sec.visualPosition ?? "middle";
                      return (
                        <AnswerFeedback
                          correct={!!checkResult}
                          answerLabel={checkResult ? "" : getCorrectAnswerLabel(sec.check)}
                          explanation={sec.explanation}
                          detail={
                            <>
                              {sec.visual && pos === "top" && <div className="mb-3"><LessonVisual visual={sec.visual} /></div>}
                              <FeedbackDetailText explanation={sec.explanation} example={sec.example} />
                              {sec.visual && pos !== "top" && <div className="mt-3"><LessonVisual visual={sec.visual} /></div>}
                            </>
                          }
                        >
                          <TakeawayChip line={takeawayFor(sec).line} />
                          <PrimaryAction label="Got it, next" onClick={next} fullWidth />
                        </AnswerFeedback>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* ── Flashcard slide ─────────────────────────────────────── */}
            {!isDone && step?.phase === "flashcard" && (() => {
              const cards = step.cardIndices.flatMap((i) => {
                const c = vocabCardForSection(displayedSections[i]);
                return c ? [c] : [];
              });
              const card = cards[flashcardIdx];
              const allRated = Object.keys(flashcardRatings).length >= cards.length;
              const currentRating = flashcardRatings[flashcardIdx];
              return (
                <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                  <Instruction>{stepInstruction(step)}</Instruction>
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
                          <p className="mt-3 text-sm text-muted">Tap the card to see the answer</p>
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
                      <p className="mb-2 text-center text-sm font-medium text-foreground">How well did you know this? Pick one.</p>
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
                        className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors disabled:opacity-30 hover:border-primary hover:text-foreground"
                      >
                        ← Back
                      </button>
                      {allRated ? (
                        <PrimaryAction label="Got it, next" onClick={next} />
                      ) : flashcardIdx < cards.length - 1 && currentRating ? (
                        <PrimaryAction
                          label="Next card"
                          onClick={() => { setFlashcardIdx((i) => i + 1); setFlashcardFlipped(false); }}
                        />
                      ) : (
                        <PrimaryAction
                          label="Show the answer"
                          onClick={() => { setFlashcardFlipped(true); setFlashcardSeen((prev) => new Set(prev).add(flashcardIdx)); }}
                          hint={showHint ? primaryHint(step) : undefined}
                        />
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
                <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                      Open practice
                    </h2>
                    <span className="rounded-full border border-border px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-muted">
                      3 marks
                    </span>
                  </div>

                  <YourTurnBanner
                    instruction={stepInstruction(step, sec)}
                    status={tutorFeedback ? "Checked: marked" : tutorAnswer.trim() ? "Answer written" : "Not answered yet"}
                    next={tutorFeedback ? "Read your feedback, then press Got it, next." : "Press Mark my answer when you are done. You get marks and feedback."}
                  />
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
                        aria-label="Your answer"
                        placeholder="Write your answer here. Explain your thinking."
                        className="w-full resize-none rounded-xl border border-border bg-surface p-4 text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none disabled:opacity-60"
                      />

                      {!tutorFeedback && (
                        <div className="mt-3">
                          <PrimaryAction
                            label={tutorLoading ? "Marking…" : "Mark my answer"}
                            onClick={submitTutorAnswer}
                            disabledReason={disabledReason(step, { hasAnswer: !!tutorAnswer.trim(), loading: tutorLoading })}
                            hint={showHint ? primaryHint(step, sec) : undefined}
                            fullWidth
                          />
                        </div>
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
                          <div className="mt-5">
                            <PrimaryAction label="Got it, next" onClick={next} fullWidth />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Recap slide ─────────────────────────────────────────── */}
            {!isDone && step?.phase === "recap" && (
              <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <h2 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
                  Recap
                </h2>
                <Instruction>{stepInstruction(step)}</Instruction>
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

                    <PrimaryAction label="Finish lesson" onClick={next} fullWidth hint="You will get your score and XP next." />
                  </div>
                </div>
              </div>
            )}

            {/* ── Done screen ─────────────────────────────────────────── */}
            {!isDone && (
              <div className="px-4 pb-8 sm:px-6">
                <ReportButton
                  contextLabel={`Lesson: ${title ?? topicId}`}
                  topicId={mode === "topic" ? topicId : undefined}
                  subtopicId={mode === "subtopic" ? topicId : undefined}
                />
              </div>
            )}

            {isDone && (
              <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
                <DoneCard
                  practiceHref={practiceHref ?? `/practice/${topicId}`}
                  flashcardsHref={flashcardsHref ?? `/flashcards/${topicId}`}
                  exitHref={exitHref}
                  correctCount={correctCount}
                  total={sections.length}
                  completion={completion}
                />
              </div>
            )}
          </div>

          {/* ── AI coach: slim collapsible side panel (bottom sheet on phones) ── */}
          {!isDone && (
            <div className="lg:sticky lg:top-[var(--lesson-bar,3.5rem)] lg:flex lg:h-[calc(100dvh-var(--lesson-bar,3.5rem))] lg:flex-col lg:overflow-hidden lg:border-l lg:border-border lg:bg-surface/40">
              <LessonTutor key={stepKey} topicId={coachTopicId ?? topicId} mode={mode} lessonId={topicId} plan={plan} stepIndex={planIdx} session={coachSession} onHint={() => setCoachSession((c) => ({ ...c, hints: c.hints + 1 }))} open={helpOpen} onOpenChange={setCoachOpen} />
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
  completion,
}: {
  practiceHref: string;
  flashcardsHref: string;
  exitHref: string;
  correctCount: number;
  total: number;
  completion: LessonCompletion | null;
}) {
  const trail = useTrail(3, {
    from: { opacity: 0, y: 16, scale: 0.95 },
    to: { opacity: 1, y: 0, scale: 1 },
    config: springs.gentle,
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
        {completion !== null && completion.earned > 0 && (
          <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-center">
            <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-highlight">
              +<CountUp value={completion.earned} unit="" label={`${completion.earned} XP earned`} />
            </p>
            <p className="text-sm text-muted">XP earned</p>
          </div>
        )}
      </animated.div>

      {completion !== null && completion.breakdown && (
        <animated.p style={trail[1]} className="text-sm text-muted">
          You earned {completion.earned} XP. {completion.breakdown}
        </animated.p>
      )}

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

type StepMemory = {
  checkResult: boolean | null;
  exampleRevealed: boolean;
  tutorAnswer: string;
  tutorFeedback: { text: string; marks: number; total: number } | null;
  flashcardRatings: Record<number, "hard" | "good" | "easy">;
  flashcardIdx: number;
  flashcardSeen: Set<number>;
};

// One imperative line saying exactly what to do on this step.
function Instruction({ children }: { children: ReactNode }) {
  return <p className="mb-4 max-w-[65ch] text-base font-medium leading-snug text-foreground">{children}</p>;
}

// The single primary action of a step: plain label, always >= 44px tall, and
// when it is disabled it says why right next to it.
function PrimaryAction({
  label,
  onClick,
  hint,
  disabledReason,
  icon,
  fullWidth,
}: {
  label: string;
  onClick: () => void;
  hint?: string;
  disabledReason?: string | null;
  icon?: ReactNode;
  fullWidth?: boolean;
}) {
  const disabled = !!disabledReason;
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : "items-start"}`}>
      <Button
        onClick={onClick}
        disabled={disabled}
        aria-describedby={disabled ? "primary-reason" : undefined}
        className={`min-h-12 gap-2 px-8 ${fullWidth ? "w-full" : ""}`}
      >
        {icon}
        {label}
      </Button>
      {disabled ? (
        <p id="primary-reason" className="text-sm text-muted">{disabledReason}</p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
