"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { applyTheme, readTheme, resolveTheme, subscribeTheme, type ThemeChoice } from "@/lib/theme";

function useThemeChoice(): ThemeChoice | null {
  return useSyncExternalStore(subscribeTheme, readTheme, () => null);
}

// One-tap switch for the navbar: shows the theme you'd switch TO.
export function ThemeToggle() {
  const choice = useThemeChoice();
  const resolved = choice === null ? null : resolveTheme(choice);
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <MotionConfig reducedMotion="user">
      <button
        type="button"
        onClick={() => applyTheme(next)}
        aria-label={resolved ? `Switch to ${next} mode` : "Switch colour mode"}
        title={resolved ? `Switch to ${next} mode` : "Switch colour mode"}
        className="relative flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <AnimatePresence mode="wait" initial={false}>
          {resolved && (
            <motion.span
              key={resolved}
              initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 60, scale: 0.7 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="flex"
            >
              {resolved === "dark" ? <Sun className="size-5" strokeWidth={2} aria-hidden /> : <Moon className="size-5" strokeWidth={2} aria-hidden />}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </MotionConfig>
  );
}

const OPTIONS: { value: ThemeChoice; label: string; hint: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", hint: "Bright background", icon: Sun },
  { value: "dark", label: "Dark", hint: "Easier on the eyes at night", icon: Moon },
  { value: "system", label: "Match my device", hint: "Follows your phone or computer", icon: Monitor },
];

// Full chooser for account settings.
export function ThemeChoiceGroup() {
  const choice = useThemeChoice();

  return (
    <div role="radiogroup" aria-label="Colour mode" className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
        const selected = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => applyTheme(value)}
            className={`flex min-h-24 flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              selected ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/60"
            }`}
          >
            <span className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Icon className="size-5" strokeWidth={2} aria-hidden /> {label}
            </span>
            <span className="text-sm text-muted">{hint}</span>
          </button>
        );
      })}
    </div>
  );
}

// Labelled row for the navbar user menu.
export function ThemeMenuRow() {
  const choice = useThemeChoice();
  const resolved = choice === null ? null : resolveTheme(choice);
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
    >
      {next === "dark" ? <Moon className="size-4" strokeWidth={2} aria-hidden /> : <Sun className="size-4" strokeWidth={2} aria-hidden />}
      {resolved ? `${next === "dark" ? "Dark" : "Light"} mode` : "Colour mode"}
    </button>
  );
}
