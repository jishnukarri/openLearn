import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const BASE =
  "rounded-lg border bg-background px-3 py-2 text-sm text-foreground " +
  "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary";

const STATE = {
  default: "border-border",
  correct: "border-success bg-success/10",
  incorrect: "border-error bg-error/10",
} as const;

type State = keyof typeof STATE;

export function TextInput({
  state = "default",
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { state?: State }) {
  return <input className={`${BASE} ${STATE[state]} ${className}`} {...props} />;
}

export function TextArea({
  state = "default",
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { state?: State }) {
  return (
    <textarea className={`${BASE} ${STATE[state]} ${className}`} {...props} />
  );
}
