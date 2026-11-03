"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "@/app/actions/auth";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/button";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signup,
    undefined
  );
  const [isTeacher, setIsTeacher] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // After a failed submit, put the cursor on the first field that needs fixing.
  useEffect(() => {
    if (state?.errors?.name) nameRef.current?.focus();
    else if (state?.errors?.email) emailRef.current?.focus();
    else if (state?.errors?.password) passwordRef.current?.focus();
  }, [state]);

  return (
    <AuthLayout>
      <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-4xl">
          Create your account
        </h1>
        <p className="mt-2 text-base text-muted">
          Let&apos;s help you study smarter for your GCSEs.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="name"
            ref={nameRef}
            name="name"
            aria-invalid={state?.errors?.name ? true : undefined}
            aria-describedby={state?.errors?.name ? "name-error" : undefined}
            autoComplete="name"
            placeholder="Your name"
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {state?.errors?.name && (
            <p id="name-error" role="alert" className="text-sm text-error">{state.errors.name[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            ref={emailRef}
            name="email"
            aria-invalid={state?.errors?.email ? true : undefined}
            aria-describedby={state?.errors?.email ? "email-error" : undefined}
            type="email"
            autoComplete="email"
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
            aria-invalid={state?.errors?.password ? true : undefined}
            aria-describedby={state?.errors?.password ? "password-error" : undefined}
            type="password"
            autoComplete="new-password"
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {state?.errors?.password && (
            <p id="password-error" role="alert" className="text-sm text-error">{state.errors.password[0]}</p>
          )}
        </div>

        {state?.message && <p role="alert" className="text-sm text-error">{state.message}</p>}

        <input type="hidden" name="isTeacher" value={isTeacher ? "1" : "0"} />

        <label className="flex cursor-pointer items-start gap-3 border-t border-border pt-5">
          <input
            type="checkbox"
            checked={isTeacher}
            onChange={(e) => setIsTeacher(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <div>
            <p className="text-sm font-medium text-foreground">I&apos;m a teacher</p>
            <p className="mt-0.5 text-sm text-muted">Your account will need admin approval before you can access the teacher dashboard.</p>
          </div>
        </label>

        <p className="text-sm text-muted">
          We keep your name, email and study progress to run your lessons. Read the{" "}
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">privacy notice</Link>{" "}
          before you sign up.
        </p>

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
      </div>
    </AuthLayout>
  );
}
