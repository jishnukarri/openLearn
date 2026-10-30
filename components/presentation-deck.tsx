"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Maximize, Minimize } from "lucide-react";
import { EASE_OUT } from "@/components/motion";

const DISPLAY = "font-[family-name:var(--font-display)]";
const H2 = `${DISPLAY} max-w-[18ch] text-balance text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl`;
const SUB = "mt-6 max-w-[42ch] text-lg leading-relaxed text-muted lg:text-2xl";

function Points({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-3 lg:gap-10">
      {items.map((p) => (
        <div key={p.title} className="border-t-2 border-border pt-4">
          <h3 className={`${DISPLAY} text-xl font-semibold leading-tight text-foreground lg:text-3xl`}>{p.title}</h3>
          <p className="mt-2 text-base leading-relaxed text-muted lg:text-xl">{p.body}</p>
        </div>
      ))}
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="border-t-2 border-border pt-4">
      <div className={`${DISPLAY} text-6xl font-semibold leading-none text-foreground lg:text-8xl`}>{n}</div>
      <p className="mt-3 max-w-[18ch] text-base leading-snug text-muted lg:text-xl">{label}</p>
    </div>
  );
}

function Step({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-surface p-5 lg:p-6">
      <h3 className={`${DISPLAY} text-xl font-semibold text-foreground lg:text-2xl`}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted lg:text-lg">{body}</p>
    </div>
  );
}

function Arrow() {
  return <ChevronRight aria-hidden className="hidden size-6 shrink-0 self-center text-primary lg:block" />;
}

function Bullets({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ul className="flex flex-col gap-6">
      {items.map((p) => (
        <li key={p.title} className="border-t-2 border-border pt-4">
          <span className={`${DISPLAY} block text-xl font-semibold text-foreground lg:text-3xl`}>{p.title}</span>
          <span className="mt-1 block text-base leading-relaxed text-muted lg:text-xl">{p.body}</span>
        </li>
      ))}
    </ul>
  );
}

type SlideDef = { seconds: number; node: (qr: string) => React.ReactNode; video?: boolean };

const SLIDES: SlideDef[] = [
  {
    seconds: 20,
    node: () => (
      <>
        <div className={`${DISPLAY} mb-8 text-3xl font-bold text-foreground lg:text-5xl`}>
          openLearn<span className="text-primary">.</span>
        </div>
        <h1 className={`${DISPLAY} max-w-[16ch] text-balance text-5xl font-semibold leading-[1.05] text-foreground sm:text-6xl lg:text-8xl`}>
          AI that marks like a real teacher
        </h1>
        <p className={SUB}>A revision platform for Computer Science, Physics and Chemistry.</p>
      </>
    ),
  },
  {
    seconds: 35,
    node: () => (
      <>
        <h2 className={H2}>Learning it once isn&apos;t always enough</h2>
        <Points
          items={[
            { title: "Everyone forgets", body: "Even a lesson you understood can fade over time. That's normal." },
            { title: "A recap isn't always enough", body: "Sometimes you need the whole lesson again, not a summary." },
            { title: "One missing detail", body: "Until you find that specific thing, it just doesn't click." },
          ]}
        />
      </>
    ),
  },
  {
    seconds: 40,
    node: () => (
      <>
        <h2 className={H2}>So I built openLearn</h2>
        <div className="mt-10 flex flex-col gap-3 lg:mt-14 lg:flex-row">
          <Step title="Find the gaps" body="A short quiz means you skip what you already know" />
          <Arrow />
          <Step title="Learn it properly" body="Step-by-step lessons with worked examples" />
          <Arrow />
          <Step title="Check it stuck" body="Practice questions, marked with feedback" />
          <Arrow />
          <Step title="Revise or redo" body="Quick revision, or the full lesson again" />
        </div>
        <p className={SUB}>Made because I loved the idea of helping students revise better.</p>
      </>
    ),
  },
  { seconds: 85, video: true, node: () => null },
  {
    seconds: 30,
    node: () => (
      <>
        <h2 className={H2}>What it can do</h2>
        <div className="mt-10 grid grid-cols-2 gap-8 lg:mt-14 lg:grid-cols-5 lg:gap-8">
          <Stat n="3" label="subjects: Computer Science, Physics, Chemistry" />
          <Stat n="23" label="topics, each with its own lesson" />
          <Stat n="20" label="question diagnostic, no account needed" />
          <Stat n="12" label="step guided lessons with an AI coach" />
          <Stat n="4" label="first-time-right answers to master a topic" />
        </div>
        <p className={SUB}>Also: handwritten-answer photo upload, flashcards, XP and daily streaks.</p>
      </>
    ),
  },
  {
    seconds: 30,
    node: () => (
      <>
        <h2 className={H2}>Why it helps</h2>
        <Points
          items={[
            { title: "Revise or relearn", body: "Do a quick revision, or go through the whole lesson again. Your choice." },
            { title: "Skip what you know", body: "A starting quiz shows your gaps, so nobody relearns what they already know." },
            { title: "Supports the teacher", body: "Teachers teach the first lesson. openLearn helps students with everything after." },
          ]}
        />
      </>
    ),
  },
  {
    seconds: 35,
    node: () => (
      <>
        <h2 className={H2}>Built for schools to run</h2>
        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-2">
          <Bullets
            items={[
              { title: "We provide", body: "The platform: lessons, quizzes, practice, flashcards and progress tracking" },
              { title: "Schools provide", body: "Their own AI connection, so they control usage and cost" },
            ]}
          />
          <Bullets
            items={[
              { title: "Teachers stay in charge", body: "They teach the first lesson. Students use openLearn to revise and practise." },
              { title: "Open by design", body: "Any school or teacher can set it up for their own students" },
            ]}
          />
        </div>
      </>
    ),
  },
  {
    seconds: 25,
    node: (qr) => (
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 className={H2}>What comes next</h2>
          <ul className="mt-10 flex flex-col gap-4 text-lg text-foreground lg:text-2xl">
            {[
              "Measure AI marking against teacher marking",
              "More subjects and exam boards",
              "Teacher view of class-wide weak spots",
              "More ways to answer, such as voice",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] h-0.5 w-4 shrink-0 bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-6 lg:justify-center">
          <div
            role="img"
            aria-label="QR code to open openLearn"
            className="size-44 shrink-0 overflow-hidden rounded-2xl border border-border bg-white lg:size-60 [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="max-w-[10ch] text-lg text-muted lg:text-2xl">Scan to try openLearn</p>
        </div>
      </div>
    ),
  },
];

const BUDGET = 5 * 60;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function PresentationDeck({ qr }: { qr: string }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const [blank, setBlank] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n))), []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    // Capture phase + stopPropagation so a clicker (PageUp/PageDown, arrows,
    // Enter, F5, "." for blank) works even when the video or a button has
    // focus, and the video's own arrow-key seeking never fights the slides.
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (t && ["BUTTON", "A"].includes(t.tagName) && (e.key === "Enter" || e.key === " ")) return;
      const onVideo = SLIDES[i].video;
      const k = e.key;
      let handled = true;
      if (["ArrowRight", "ArrowDown", "PageDown", "Enter", "n", "N"].includes(k) || (k === " " && !onVideo)) go(i + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"].includes(k)) go(i - 1);
      else if (k === "Home") go(0);
      else if (k === "End") go(SLIDES.length - 1);
      else if (k === " " && onVideo) { const v = video.current; if (v) void (v.paused ? v.play() : v.pause()); }
      else if (k === "F5" || k === "f" || k === "F") toggleFull();
      else if (k === "." || k === "b" || k === "B") setBlank((x) => !x);
      else if (k === "t" || k === "T") setRunning((r) => !r);
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    };
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [i, go, toggleFull]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const slide = SLIDES[i];

  return (
    <div
      ref={root}
      className="flex min-h-[calc(100dvh-6rem)] flex-col bg-background px-6 py-6 lg:px-12 lg:py-8"
      aria-roledescription="presentation"
      onClickCapture={(e) => (e.target as HTMLElement).closest<HTMLElement>("button,a")?.blur()}
    >
      <div className="relative flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.section
            key={i}
            aria-label={`Slide ${i + 1} of ${SLIDES.length}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
            className="mx-auto w-full max-w-6xl"
          >
            {slide.video ? (
              <div className="group fixed inset-0 z-[100] bg-black">
                <video
                  ref={video}
                  src="/admin/presentation/file/demo.mp4"
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  tabIndex={-1}
                  className="size-full object-contain"
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => go(i - 1)} className="pointer-events-auto rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur">Back</button>
                  <button type="button" onClick={() => go(i + 1)} className="pointer-events-auto rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur">Next</button>
                </div>
              </div>
            ) : (
              slide.node(qr)
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* In full screen the controls go away; keys still work and Esc exits. */}
      {!full && <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted">
        <div className="flex items-center gap-3 tabular-nums">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {running ? "Pause timer" : "Start timer"}
          </button>
          <span className={sec > BUDGET ? "text-error-ink" : undefined}>
            {fmt(sec)} / {fmt(BUDGET)}
          </span>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Slide navigation">
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide" className="rounded-lg p-2 text-foreground hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-14 text-center tabular-nums">{i + 1} / {SLIDES.length}</span>
          <button type="button" onClick={() => go(i + 1)} disabled={i === SLIDES.length - 1} aria-label="Next slide" className="rounded-lg p-2 text-foreground hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/admin/presentation/file/handout.pdf"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Download className="size-4" /> Handout (PDF)
          </a>
          <button
            type="button"
            onClick={toggleFull}
            aria-label={full ? "Exit full screen" : "Full screen"}
            className="rounded-lg border border-border bg-surface p-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>
        </div>
      </footer>}

      {blank && <div className="fixed inset-0 z-[200] bg-black" aria-hidden />}

      <div className="sr-only" aria-live="polite">Slide {i + 1} of {SLIDES.length}. Press F for full screen, T for the timer, B for a blank screen.</div>
    </div>
  );
}
