"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { EASE_OUT } from "./motion";

export type CalloutTone = "info" | "success" | "error" | "warning" | "neutral";

const TONE: Record<CalloutTone, string> = {
  info: "border-primary/40 bg-primary/10 text-primary-ink",
  success: "border-success/40 bg-success/10 text-success-ink",
  error: "border-error/40 bg-error/10 text-error-ink",
  warning: "border-highlight/40 bg-highlight/10 text-highlight-ink",
  neutral: "border-border bg-surface text-foreground",
};

const SIZE = {
  // Verdict / status banners: bold 16px copy.
  md: "px-4 py-3 text-base font-medium",
  // Quiet page-level notices: 14px regular copy.
  sm: "px-4 py-2 text-sm",
} as const;

// One highlight / status / pending notice. A full tinted border (never a thick
// side stripe), -ink text for contrast, and a short entrance that reduced-motion
// users get as a plain fade. `role` defaults to "status"; pass "alert" for
// errors that must interrupt, or "none" when an ancestor already owns the live
// region. `live` overrides aria-live (e.g. "polite" on a role="none" notice).
export function Callout({
  tone = "neutral",
  icon: Icon,
  title,
  children,
  action,
  role = "status",
  live,
  size = "md",
  id,
  className = "",
}: {
  tone?: CalloutTone;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert" | "none";
  live?: "polite" | "assertive" | "off";
  size?: keyof typeof SIZE;
  id?: string;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        id={id}
        role={role === "none" ? undefined : role}
        aria-live={live}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className={`rounded-xl border ${SIZE[size]} ${TONE[tone]} ${className}`.trim()}
      >
        <div className="flex items-start gap-2">
          {Icon && <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />}
          <div className="min-w-0 flex-1">
            {title && <p className="font-semibold">{title}</p>}
            {children}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </motion.div>
    </MotionConfig>
  );
}
