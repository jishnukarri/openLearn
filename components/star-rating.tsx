"use client";

import { MotionConfig, motion } from "framer-motion";
import { EASE_OUT } from "@/components/motion";

const STAR_PATH =
  "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01L12 2z";

// A fanned semicircle of 5 stars, deliberately coarser than a raw
// percentage, so a diagnostic reads as "here's roughly where you're at"
// rather than a score to feel bad or overconfident about. Every star
// settles at exactly the same size: they appear one after another, then
// the earned ones fill in with a short warm pulse.
export function StarRating({ score, size = 28 }: { score: number; size?: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(score * 5)));
  const radius = size * 2.1;
  const spread = 130; // total degrees the fan covers
  const width = radius * 2 + size;
  const height = radius + size;
  const originX = width / 2;
  const originY = height;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative mx-auto"
        style={{ width, height }}
        role="img"
        aria-label={`${filled} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const angleDeg = -spread / 2 + (spread / 4) * i;
          const angleRad = (angleDeg * Math.PI) / 180;
          const x = originX + radius * Math.sin(angleRad) - size / 2;
          const y = originY - radius * Math.cos(angleRad) - size / 2;
          const isFilled = i < filled;

          return (
            <motion.div
              key={i}
              style={{ position: "absolute", left: x, top: y, width: size, height: size }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: isFilled ? [1, 1.18, 1] : 1 }}
              transition={{
                opacity: { duration: 0.35, delay: i * 0.09, ease: EASE_OUT },
                scale: isFilled
                  ? { duration: 0.5, delay: 0.55 + i * 0.12, ease: EASE_OUT, times: [0, 0.4, 1] }
                  : { duration: 0.4, delay: i * 0.09, ease: EASE_OUT },
              }}
            >
              <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
                <path
                  d={STAR_PATH}
                  fill="var(--surface)"
                  stroke="var(--border)"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                />
                {isFilled && (
                  <motion.path
                    d={STAR_PATH}
                    fill="var(--highlight)"
                    stroke="var(--highlight)"
                    strokeWidth={1.2}
                    strokeLinejoin="round"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.55 + i * 0.12, ease: EASE_OUT }}
                  />
                )}
              </svg>
            </motion.div>
          );
        })}
      </div>
    </MotionConfig>
  );
}
