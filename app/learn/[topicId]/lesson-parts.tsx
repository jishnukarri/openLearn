"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/button";

// ── Scroll-to-advance ──────────────────────────────────────────────────────
// Wraps a step's primary "Continue"-style button, when the button scrolls
// into view (student reads to the bottom of the step) it auto-fires the
// same handler the button would on click. The button itself stays visible
// and clickable underneath, so it works identically for anyone who prefers
// clicking, keyboard nav, or reduced motion.
export function ScrollTrigger({
  onReached,
  children,
}: {
  onReached: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const el = ref.current;
    if (!el) return;
    // Only a real scroll counts: if the button is already on screen when it
    // mounts (short steps), the student must click it, otherwise revealing
    // content would skip straight past it before it can be read.
    let initial = true;
    let startedOffscreen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (initial) {
          initial = false;
          startedOffscreen = !entry.isIntersecting;
          return;
        }
        if (startedOffscreen && entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          onReached();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref}>{children}</div>;
}

// Fixed bottom-center "keep scrolling" hint, shown whenever the page has
// more content below the fold than the viewport currently shows. Fades out
// once the student nears the bottom (where the actual button/ScrollTrigger
// takes over), and reappears on the next step. Purely a visual affordance —
// scrolling back up always works, this never locks or redirects scroll.
export function ScrollHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function check() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const remaining = scrollable - window.scrollY;
      setVisible(scrollable > 80 && remaining > 120);
    }
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const id = window.setInterval(check, 500); // catches content growing without a scroll/resize event
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.clearInterval(id);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="rounded-full border border-border bg-surface/90 px-3 py-1.5 text-muted shadow-lg backdrop-blur-sm">
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </div>
    </div>
  );
}

// ── Quit modal ─────────────────────────────────────────────────────────────
export function QuitModal({ onKeepGoing, onQuit }: { onKeepGoing: () => void; onQuit: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onKeepGoing}
    >
      <div
        className="mx-4 flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertTriangle className="mx-auto size-8 text-highlight" strokeWidth={1.75} />
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            Quit this lesson?
          </p>
          <p className="mt-1 text-sm text-muted">Your progress will be lost.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={onKeepGoing} className="w-full justify-center">Keep going</Button>
          <button
            type="button"
            onClick={onQuit}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium text-error transition-colors hover:border-error hover:bg-error/10"
          >
            Quit lesson
          </button>
        </div>
      </div>
    </div>
  );
}

