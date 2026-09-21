"use client";

import { useActionState, useState } from "react";
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

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted">
          Let&apos;s help you study smarter for your GCSEs.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="name"
            name="name"
            placeholder="Your name"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {state?.errors?.name && (
            <p className="text-xs text-error">{state.errors.name[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {state?.errors?.email && (
            <p className="text-xs text-error">{state.errors.email[0]}</p>
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
            name="password"
            type="password"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {state?.errors?.password && (
            <p className="text-xs text-error">{state.errors.password[0]}</p>
          )}
        </div>

        {state?.message && <p className="text-sm text-error">{state.message}</p>}

        <input type="hidden" name="isTeacher" value={isTeacher ? "1" : "0"} />

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={isTeacher}
            onChange={(e) => setIsTeacher(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <div>
            <p className="text-sm font-medium text-foreground">I&apos;m a teacher</p>
            <p className="text-xs text-muted">Your account will need admin approval before you can access the teacher dashboard.</p>
          </div>
        </label>

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
      </div>
    </AuthLayout>
  );
}
