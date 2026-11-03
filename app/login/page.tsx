"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { login, type AuthFormState } from "@/app/actions/auth";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/button";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    login,
    undefined
  );

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // After a failed submit, put the cursor on the first field that needs fixing.
  useEffect(() => {
    if (state?.errors?.email) emailRef.current?.focus();
    else if (state?.errors?.password) passwordRef.current?.focus();
  }, [state]);

  return (
    <AuthLayout>
      <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-4xl">Welcome back</h1>
        <p className="mt-2 text-base text-muted">Pick up right where you left off.</p>
      </div>

      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            ref={emailRef}
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={state?.errors?.email ? true : undefined}
            aria-describedby={state?.errors?.email ? "email-error" : undefined}
            placeholder="you@example.com"
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {state?.errors?.email && (
            <p id="email-error" role="alert" className="text-sm text-error">{state.errors.email[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={state?.errors?.password ? true : undefined}
            aria-describedby={state?.errors?.password ? "password-error" : undefined}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {state?.errors?.password && (
            <p id="password-error" role="alert" className="text-sm text-error">{state.errors.password[0]}</p>
          )}
        </div>

        {state?.message && <p role="alert" className="text-sm text-error">{state.message}</p>}

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "Logging in..." : "Log In"}
        </Button>
      </form>

      <p className="text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
      <p className="text-sm text-muted">
        <Link href="/privacy" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">Privacy notice</Link>
      </p>
      </div>
    </AuthLayout>
  );
}
