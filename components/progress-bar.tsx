"use client";

import { animated, useSpring } from "@react-spring/web";
import { springs, useReducedMotionSafe } from "@/lib/motion";

// Spring-filled progress bar shared by the lesson player and the
// diagnostic, `value` and `max` describe steps completed out of total.
export function ProgressBar({ value, max }: { value: number; max: number }) {
  useReducedMotionSafe();
  const progress = useSpring({
    width: `${max > 0 ? (value / max) * 100 : 0}%`,
    config: springs.snappy,
  });

  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface">
      <animated.div
        style={progress}
        className="h-full rounded-full bg-primary shadow-[0_0_10px_0_var(--primary)]"
      />
    </div>
  );
}
