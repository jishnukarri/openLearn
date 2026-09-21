"use client";

import { animated, useSpring } from "@react-spring/web";
import { useReducedMotionSafe } from "@/lib/motion";

// Counts up from 0 to `value` on mount, used for XP and other stats so
// numbers feel earned rather than static.
export function AnimatedNumber({ value }: { value: number }) {
  useReducedMotionSafe();
  const { n } = useSpring({
    from: { n: 0 },
    n: value,
    config: { tension: 80, friction: 24 },
  });
  return <animated.span>{n.to((v) => Math.round(v).toLocaleString())}</animated.span>;
}
