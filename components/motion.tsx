"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

// Staggers its <Rise> children in on mount. Reduced-motion users get the
// opacity fade only (framer drops transforms under reducedMotion="user").
export function Stagger({
  children,
  className,
  delay = 0.05,
  gap = 0.07,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
        className={className}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

export function Rise({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={rise} className={className}>
      {children}
    </motion.div>
  );
}
