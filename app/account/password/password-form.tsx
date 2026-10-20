"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, type PasswordFormState } from "@/app/actions/account";
import { SubmitButton } from "@/components/submit-button";
import { validateNewPassword } from "@/lib/password-policy";

const INPUT =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-error";

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useActionState<PasswordFormState, FormData>(changePasswordAction, undefined);
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const live = touched && next ? validateNewPassword(current || "\u0000", next, confirm || next) : null;
  const matchError = touched && confirm && confirm !== next ? "The two new passwords don't match." : null;
  const errs = {
    currentPassword: state?.errors?.currentPassword,
    newPassword: state?.errors?.newPassword ?? live ?? undefined,
    confirmPassword: state?.errors?.confirmPassword ?? matchError ?? undefined,
  };
  const type = show ? "text" : "password";

  function field(
    id: "currentPassword" | "newPassword" | "confirmPassword",
    label: string,
    auto: string,
    value: string,
    set: (v: string) => void,
    hint?: string
  ) {
    const err = errs[id];
    const describedBy = [hint ? `${id}-hint` : null, err ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={auto}
          required
          value={value}
          onChange={(e) => {
            set(e.target.value);
            setTouched(true);
          }}
          aria-invalid={err ? true : undefined}
          aria-describedby={describedBy}
          className={INPUT}
        />
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        )}
        {err && (
          <p id={`${id}-error`} role="alert" className="text-sm text-error">
            {err}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {field(
        "currentPassword",
        forced ? "Temporary password from your administrator" : "Current password",
        "current-password",
        current,
        setCurrent
      )}
      {field("newPassword", "New password", "new-password", next, setNext, "At least 8 characters.")}
      {field("confirmPassword", "Confirm new password", "new-password", confirm, setConfirm)}

      <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="size-5 accent-[var(--primary)]"
        />
        Show passwords
      </label>

      {state?.message && (
        <p role={state.success ? "status" : "alert"} className={`text-sm ${state.success ? "text-foreground" : "text-error"}`}>
          {state.message}
        </p>
      )}

      <div>
        <SubmitButton pendingText="Changing password…">Change password</SubmitButton>
      </div>
    </form>
  );
}
