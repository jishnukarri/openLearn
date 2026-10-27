"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calculator as CalcIcon, ChevronDown } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { evaluateExpression, formatResult } from "@/lib/calc-eval";

const ROWS: { label: string; aria: string; insert?: string; action?: "clear" | "back" | "equals"; span?: number }[][] = [
  [
    { label: "C", aria: "Clear", action: "clear" },
    { label: "(", aria: "Open bracket", insert: "(" },
    { label: ")", aria: "Close bracket", insert: ")" },
    { label: "⌫", aria: "Backspace", action: "back" },
  ],
  [
    { label: "√", aria: "Square root", insert: "√(" },
    { label: "^", aria: "Power", insert: "^" },
    { label: "Ans", aria: "Previous answer", insert: "Ans" },
    { label: "÷", aria: "Divide", insert: "÷" },
  ],
  [
    { label: "7", aria: "7", insert: "7" },
    { label: "8", aria: "8", insert: "8" },
    { label: "9", aria: "9", insert: "9" },
    { label: "×", aria: "Multiply", insert: "×" },
  ],
  [
    { label: "4", aria: "4", insert: "4" },
    { label: "5", aria: "5", insert: "5" },
    { label: "6", aria: "6", insert: "6" },
    { label: "−", aria: "Subtract", insert: "−" },
  ],
  [
    { label: "1", aria: "1", insert: "1" },
    { label: "2", aria: "2", insert: "2" },
    { label: "3", aria: "3", insert: "3" },
    { label: "+", aria: "Add", insert: "+" },
  ],
  [
    { label: "0", aria: "0", insert: "0" },
    { label: ".", aria: "Decimal point", insert: "." },
    { label: "=", aria: "Equals", action: "equals", span: 2 },
  ],
];

const KEY =
  "min-h-11 touch-manipulation rounded-lg border border-border bg-background text-base font-medium text-foreground " +
  "transition-[transform,background-color,border-color] duration-150 hover:border-primary active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none motion-reduce:active:scale-100";

// Compact calculator for numeric questions. Render it only for numeric
// answers; "Use result" hands the value to `onUse` (paste into the answer).
export function Calculator({
  onUse,
  returnFocusTo,
}: {
  onUse: (value: string) => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const reduce = useReducedMotion();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [ans, setAns] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const displayRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) displayRef.current?.focus();
  }, [open]);

  function close(focus: RefObject<HTMLElement | null> | undefined) {
    setOpen(false);
    (focus?.current ?? toggleRef.current)?.focus();
  }

  function evaluate(): string | null {
    if (!expr.trim()) return result;
    const v = evaluateExpression(expr, ans);
    if (v === null) {
      setError(true);
      setResult(null);
      return null;
    }
    const text = formatResult(v);
    setError(false);
    setResult(text);
    setAns(Number(text));
    return text;
  }

  function edit(next: string) {
    setExpr(next);
    setError(false);
  }

  function press(key: (typeof ROWS)[number][number]) {
    if (key.action === "clear") {
      edit("");
      setResult(null);
    } else if (key.action === "back") edit(expr.slice(0, -1));
    else if (key.action === "equals") evaluate();
    else if (key.insert) {
      // Starting with an operator after a result continues from that result.
      const startsWithOp = expr === "" && result !== null && /^[+−×÷^]$/.test(key.insert);
      edit((startsWithOp ? "Ans" : expr) + key.insert);
    }
    displayRef.current?.focus();
  }

  function useResult() {
    const text = evaluate();
    if (text === null) {
      displayRef.current?.focus();
      return;
    }
    onUse(text);
    close(returnFocusTo);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close(undefined) : setOpen(true))}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <CalcIcon className="size-4 text-muted" strokeWidth={2} aria-hidden />
        Calculator
        <ChevronDown
          className={`size-4 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="group"
            aria-label="Calculator"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.25, ease: EASE_OUT }}
            className="w-full max-w-xs overflow-hidden"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close(undefined);
              }
            }}
          >
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
              <input
                ref={displayRef}
                value={expr}
                onChange={(e) => edit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    evaluate();
                  }
                }}
                aria-label="Calculator expression"
                maxLength={200}
                aria-invalid={error}
                autoComplete="off"
                spellCheck={false}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-right font-mono text-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <p
                aria-live="polite"
                className={`min-h-6 text-right font-mono text-base ${error ? "text-error-ink" : "text-muted"}`}
              >
                {error ? "Check the expression" : result !== null ? `= ${result}` : " "}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {ROWS.flat().map((key) => (
                  <button
                    key={key.label}
                    type="button"
                    aria-label={key.aria}
                    onClick={() => press(key)}
                    className={`${KEY} ${key.span === 2 ? "col-span-2" : ""} ${
                      key.action === "equals" ? "border-primary text-primary-ink" : ""
                    }`}
                  >
                    {key.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={useResult}
                className="min-h-11 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Use result
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
