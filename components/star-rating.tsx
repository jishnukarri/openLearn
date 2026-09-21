"use client";

import { animated, useTrail } from "@react-spring/web";
import { springs, useReducedMotionSafe } from "@/lib/motion";

const STAR_PATH =
  "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01L12 2z";

// A fanned semicircle of 5 stars, deliberately coarser than a raw
// percentage, so a diagnostic reads as "here's roughly where you're at"
// rather than a score to feel bad or overconfident about.
export function StarRating({ score, size = 28 }: { score: number; size?: number }) {
  useReducedMotionSafe();
  const filled = Math.max(0, Math.min(5, Math.round(score * 5)));
  const radius = size * 2.1;
  const spread = 130; // total degrees the fan covers
  const width = radius * 2 + size;
  const height = radius + size;
  const originX = width / 2;
  const originY = height;

  const trail = useTrail(5, {
    from: { opacity: 0, scale: 0.3 },
    to: { opacity: 1, scale: 1 },
    config: springs.wobbly,
  });

  return (
    <div
      className="relative mx-auto"
      style={{ width, height }}
      role="img"
      aria-label={`${filled} out of 5 stars`}
    >
      {trail.map((style, i) => {
        const angleDeg = -spread / 2 + (spread / 4) * i;
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = originX + radius * Math.sin(angleRad) - size / 2;
        const y = originY - radius * Math.cos(angleRad) - size / 2;
        const isFilled = i < filled;

        return (
          <animated.div
            key={i}
            style={{
              opacity: style.opacity,
              transform: style.scale.to((s) => `scale(${s})`),
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
            }}
          >
            <svg viewBox="0 0 24 24" width={size} height={size}>
              <path
                d={STAR_PATH}
                fill={isFilled ? "var(--highlight)" : "var(--surface)"}
                stroke={isFilled ? "var(--highlight)" : "var(--border)"}
                strokeWidth={1.2}
                strokeLinejoin="round"
              />
            </svg>
          </animated.div>
        );
      })}
    </div>
  );
}
