"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animated, useSpring } from "@react-spring/web";
import { PartyPopper, ArrowLeft } from "lucide-react";
import type { Flashcard } from "@/lib/ai/flashcards";
import { springs, useReducedMotionSafe } from "@/lib/motion";
import { Button, ButtonLink } from "@/components/button";
import { completeRevisionDeckAction } from "@/app/actions/lessons";
import { ProgressBar } from "@/components/progress-bar";
import { RichText } from "@/components/rich-text";

// SM-2 quality: 0–5. We expose three buttons:
//   Hard  → q=2  (reset reps, re-shows after 1 more card)
//   Good  → q=4  (normal progress)
//   Easy  → q=5  (learned, removed from queue)
type CardState = {
  interval: number;       // days (1 initially)
  repetitions: number;    // n
  easeFactor: number;     // EF, starts 2.5
  dueIn: number;          // queue-position offset (used for in-session ordering)
};

function sm2Update(state: CardState, q: 0 | 2 | 4 | 5): CardState {
  let { interval, repetitions, easeFactor } = state;

  if (q < 3) {
    // Failed recall, reset
    interval = 1;
    repetitions = 0;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  return { interval, repetitions, easeFactor, dueIn: interval };
}

function initState(): CardState {
  return { interval: 1, repetitions: 0, easeFactor: 2.5, dueIn: 1 };
}

// A spaced-rep review deck: tap to flip, then rate Hard / Good / Easy.
// Hard cards return within the session; Easy cards leave immediately.
// Shows estimated next-review interval so students know how the algorithm
// is scheduling them.
export function FlashcardDeck({
  topicId,
  cards,
  lessonHref,
}: {
  topicId: string;
  cards: Flashcard[];
  lessonHref?: string;
}) {
  const backHref = lessonHref ?? `/learn/${topicId}`;
  useReducedMotionSafe();

  // queue entries: card index
  const [queue, setQueue] = useState(() => cards.map((_, i) => i));
  const [states, setStates] = useState<CardState[]>(() => cards.map(initState));
  const [flipped, setFlipped] = useState(false);
  const [graduated, setGraduated] = useState<Set<number>>(new Set());
  const [lastInterval, setLastInterval] = useState<number | null>(null);

  const total = cards.length;
  const current = queue[0];
  const done = queue.length === 0;
  const [earnedXp, setEarnedXp] = useState(0);
  const awarded = useRef(false);
  useEffect(() => {
    if (!done || awarded.current) return;
    awarded.current = true;
    completeRevisionDeckAction().then((r) => setEarnedXp(r.xp)).catch(() => {});
  }, [done]);

  const flip = useSpring({
    transform: `rotateY(${flipped ? 180 : 0}deg)`,
    config: springs.gentle,
  });

  function rate(q: 0 | 2 | 4 | 5) {
    const idx = current;
    const newState = sm2Update(states[idx], q);
    setLastInterval(newState.interval);
    setStates((prev) => {
      const next = [...prev];
      next[idx] = newState;
      return next;
    });
    setFlipped(false);

    if (q >= 4) {
      // Good or Easy, graduate from deck
      setGraduated((prev) => new Set(prev).add(idx));
      setQueue((q) => q.slice(1));
    } else {
      // Hard, reinsert after ~1 more card
      setQueue((q) => {
        const rest = q.slice(1);
        const insertAt = Math.min(1, rest.length);
        return [...rest.slice(0, insertAt), idx, ...rest.slice(insertAt)];
      });
    }
  }

  function reset() {
    setQueue(cards.map((_, i) => i));
    setStates(cards.map(initState));
    setGraduated(new Set());
    setFlipped(false);
    setLastInterval(null);
  }

  if (done) {
    return (
      <div className="animate-pop-in flex flex-col items-center gap-4 rounded-2xl border border-success/40 bg-success/10 p-8 text-center">
        <PartyPopper className="size-8 text-success" strokeWidth={1.75} />
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          Deck complete!
        </p>
        <p className="text-sm text-muted">
          You went through all {total} cards. Come back tomorrow to review the ones scheduled for tomorrow.
        </p>
        {earnedXp > 0 && (
          <p className="font-[family-name:var(--font-mono)] text-lg font-semibold text-highlight">+{earnedXp} XP for revising</p>
        )}
        <div className="flex gap-3">
          <Button onClick={reset}>Review again</Button>
          <ButtonLink href={backHref} variant="secondary">
            Back to lesson
          </ButtonLink>
        </div>
      </div>
    );
  }

  const card = cards[current];
  const intervalDays = states[current].interval;

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar value={graduated.size} max={total} />
      <p className="text-sm text-muted">
        {graduated.size}/{total} learned · {queue.length} left
      </p>

      <div className="relative h-72 [perspective:1000px] lg:h-80">
        <animated.button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          style={{ transform: flip.transform, transformStyle: "preserve-3d" }}
          className="absolute inset-0 h-full w-full cursor-pointer rounded-2xl"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-6 text-center [backface-visibility:hidden]">
            <p className="text-sm font-medium text-muted">Term</p>
            <p className="text-xl font-medium text-foreground lg:text-2xl">
              <RichText text={card.front} />
            </p>
            <p className="mt-4 text-sm text-muted">Tap to flip</p>
          </div>
          <div
            style={{ transform: "rotateY(180deg)" }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center [backface-visibility:hidden]"
          >
            <p className="text-sm font-medium text-primary">Answer</p>
            <p className="text-xl font-medium text-foreground lg:text-2xl">
              <RichText text={card.back} />
            </p>
          </div>
        </animated.button>
      </div>

      {flipped && (
        <div className="animate-fade-slide-up flex flex-col gap-3">
          <p className="text-sm text-muted">How well did you know this?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => rate(2)}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-error/40 bg-error/10 px-5 py-2.5 text-sm font-medium text-error hover:bg-error/20"
            >
              <span>Hard</span>
              <span className="text-xs font-normal opacity-70">see again soon</span>
            </button>
            <button
              type="button"
              onClick={() => rate(4)}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/20"
            >
              <span>Good</span>
              <span className="text-xs font-normal opacity-70">~{intervalDays}d</span>
            </button>
            <button
              type="button"
              onClick={() => rate(5)}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-success/40 bg-success/10 px-5 py-2.5 text-sm font-medium text-success hover:bg-success/20"
            >
              <span>Easy</span>
              <span className="text-xs font-normal opacity-70">learned</span>
            </button>
          </div>
          {lastInterval !== null && (
            <p className="text-sm text-muted">
              Last card: scheduled for review in ~{lastInterval} {lastInterval === 1 ? "day" : "days"}
            </p>
          )}
        </div>
      )}

      <Link href={backHref} className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back to lesson
      </Link>
    </div>
  );
}
