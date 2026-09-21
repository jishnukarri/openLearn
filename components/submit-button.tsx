"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/button";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";
type Size = "default" | "compact";

/**
 * Drop-in for <Button type="submit"> inside server-action forms.
 * Reads useFormStatus so it disables itself the moment the form submits,
 * preventing double-clicks from firing the action twice.
 *
 * Accepts an optional `pendingText` label shown while the action is running.
 */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || props.disabled}
      aria-disabled={pending}
      {...props}
    >
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
