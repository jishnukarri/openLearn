"use client";

import { MotionConfig, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { EASE_OUT } from "./motion";

// Left panel of the auth pages: a live miniature of "The Markup" (DESIGN.md's
// signature moment) so the sign-in screen shows the product's promise, not
// just a form. Fixed example, no AI call.
export function AuthShowcase() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex max-w-md flex-col gap-10">
        <BrandMark size={48} />
        <h2 className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.1] text-foreground xl:text-5xl">
          Marked like a real teacher marked it.
        </h2>

        <div className="flex flex-col gap-5">
          <p className="text-base leading-loose text-foreground">
            <span>Metals are conductors because </span>
            <span className="relative font-medium">
              they have delocalised electrons
              <motion.span
                aria-hidden
                className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-success"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.9, ease: EASE_OUT }}
              />
            </span>
            <span>, </span>
            <span className="relative text-error">
              because they are shiny and heavy
              <motion.span
                aria-hidden
                className="absolute inset-x-0 top-1/2 h-0.5 origin-left bg-error"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 1.9, ease: EASE_OUT }}
              />
            </span>
            <span>.</span>
          </p>

          <motion.ul
            className="flex flex-col gap-2 text-sm text-muted"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.4, ease: EASE_OUT }}
          >
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} />
              Correctly identifies delocalised electrons.
            </li>
            <li className="flex items-start gap-2">
              <X className="mt-0.5 size-4 shrink-0 text-error" strokeWidth={2.5} />
              &ldquo;Shiny and heavy&rdquo; isn&apos;t why metals conduct, so no mark here.
            </li>
            <li className="mt-1 font-[family-name:var(--font-mono)] text-sm font-semibold text-primary">
              1/2 marks
            </li>
          </motion.ul>
        </div>
      </div>
    </MotionConfig>
  );
}
