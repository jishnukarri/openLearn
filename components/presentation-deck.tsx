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
    seconds: 8,
    node: () => (
      <>
        <div className={`${DISPLAY} mb-8 text-3xl font-bold text-foreground lg:text-5xl`}>
          openLearn<span className="text-primary">.</span>
        </div>
        <h1 className={`${DISPLAY} max-w-[16ch] text-balance text-5xl font-semibold leading-[1.05] text-foreground sm:text-6xl lg:text-8xl`}>
          An AI tutor that never gets tired
        </h1>
        <p className={SUB}>Helping students relearn what they have forgotten.</p>
      </>
    ),
  },
  {
    seconds: 27,
    node: () => (
      <>
        <h2 className={H2}>The problem: people forget</h2>
        <Points
          items={[
            { title: "Students forget", body: "Even a lesson you understood can fade. That is normal." },
            { title: "A recap isn't always enough", body: "Sometimes you need the whole lesson again to find the one detail that makes it click." },
            { title: "Teachers run out of time", body: "There is no curriculum time to re-teach every small topic for every student." },
          ]}
        />
      </>
    ),
  },
  {
    seconds: 30,
    node: () => (
      <>
        <h2 className={H2}>The fix: an AI that teaches it again</h2>
        <Points
          items={[
            { title: "It builds the lesson", body: "Any topic, as many times as a student needs, without using up class time." },
            { title: "It teaches like a teacher", body: "It shows it, does it together, then lets the student try: I do, we do, you do." },
            { title: "It answers and marks", body: "Students can ask the AI tutor anything. Written answers are marked point by point." },
          ]}
        />
      </>
    ),
  },
  { seconds: 189, video: true, node: () => null },
  {
    seconds: 22,
    node: (qr) => (
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 className={H2}>Built for schools to run</h2>
          <div className="mt-10">
            <Bullets
              items={[
                { title: "Teachers stay in charge", body: "They teach the first lesson. openLearn helps students revise it, again and again." },
                { title: "Schools bring their own AI", body: "The platform is open, and each school controls its own usage and cost." },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-6 lg:flex-col lg:items-start">
          <div
            role="img"
            aria-label="QR code to open openLearn"
            className="size-44 shrink-0 overflow-hidden rounded-2xl border border-border bg-white lg:size-60 [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="max-w-[12ch] text-lg text-muted lg:text-2xl">Scan to try openLearn</p>
        </div>
      </div>
    ),
  },
];

const VIDEO_SRC = "/admin/presentation/file/demo.mp4";
const BUDGET = 5 * 60;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function PresentationDeck({ qr }: { qr: string }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const [blank, setBlank] = useState(false);
  // In full screen the slide text is scaled up so it fills the screen instead
  // of sitting small in the middle. 1 in a normal window.
  const [zoom, setZoom] = useState(1);
  // The demo video is downloaded into memory as soon as the deck opens, so by
  // slide 4 it plays from a local blob with no buffering. `lockedSrc` is fixed
  // when the video slide first shows, so a late finish never restarts playback.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [lockedSrc, setLockedSrc] = useState<string | null>(null);
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
    const ctrl = new AbortController();
    let url: string | null = null;
    (async () => {
      try {
        const res = await fetch(VIDEO_SRC, { signal: ctrl.signal });
        if (!res.ok || !res.body) return;
        const total = Number(res.headers.get("content-length")) || 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value as Uint8Array<ArrayBuffer>);
          got += value.length;
          if (total) setLoaded(Math.min(99, Math.round((got / total) * 100)));
        }
        url = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
        setLoaded(100);
        setBlobUrl(url);
      } catch {
        /* aborted or offline: the video slide streams the file instead */
      }
    })();
    return () => {
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    if (SLIDES[i].video && !lockedSrc) setLockedSrc(blobUrl ?? VIDEO_SRC);
  }, [i, blobUrl, lockedSrc]);

  useEffect(() => {
    const fit = () => setZoom(full ? Math.min(2.4, Math.max(1, Math.min(window.innerWidth / 1280, window.innerHeight / 720))) : 1);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [full]);

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
            style={slide.video ? undefined : { zoom }}
          >
            {slide.video ? (
              <div className="group fixed inset-0 z-[100] bg-black">
                <video
                  ref={video}
                  src={lockedSrc ?? undefined}
                  onError={() => setLockedSrc((cur) => (cur?.startsWith("blob:") ? VIDEO_SRC : cur))}
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
          <span className="text-xs" aria-live="polite">{loaded >= 100 ? "Video ready" : `Loading video ${loaded}%`}</span>
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
