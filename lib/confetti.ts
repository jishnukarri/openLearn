"use client";

import confetti from "canvas-confetti";

// Brand-colored burst — coral/amber/indigo, matching the DESIGN.md rule that
// coral+amber are reserved for exactly this kind of celebration moment.
export function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#6D6AFF", "#FF8A78", "#FFC24D"],
    disableForReducedMotion: true,
  });
}

// Small localized burst at a viewport position (0-1 fractions) — used when a
// student picks the correct quick-check answer, popping from the button.
export function burstAt(x: number, y: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  confetti({
    particleCount: 24,
    spread: 55,
    startVelocity: 18,
    scalar: 0.7,
    ticks: 90,
    origin: { x, y },
    colors: ["#6D6AFF", "#FF8A78", "#FFC24D", "#3DDC84"],
    disableForReducedMotion: true,
  });
}
