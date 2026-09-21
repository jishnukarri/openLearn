"use client";

import { useEffect } from "react";
import { Globals } from "@react-spring/web";

// Shared spring presets so motion feels consistent app-wide.
export const springs = {
  // Quick, confident UI feedback (button presses, progress).
  snappy: { tension: 300, friction: 20 },
  // Softer entrances (cards, staged reveals).
  gentle: { tension: 170, friction: 24 },
  // Bouncy celebration moments.
  wobbly: { tension: 220, friction: 12 },
} as const;

// Call once in any top-level client component: collapses every react-spring
// animation to an instant jump for users who prefer reduced motion.
export function useReducedMotionSafe() {
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => Globals.assign({ skipAnimation: mql.matches });
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
}
