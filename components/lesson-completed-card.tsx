import Link from "next/link";
import { ButtonLink } from "@/components/button";

// Shown instead of the lesson when a student has already finished it. A green
// card with a tick that draws itself, and the choice that matters: go straight
// to the exam questions (the student already knows this), or run the lesson
// again. Server-rendered on purpose: while this is showing, the lesson itself is
// not loaded or generated, so skipping costs nothing.
export function LessonCompletedCard({
  title,
  practiceHref,
  redoHref,
  backHref = "/dashboard",
}: {
  title: string;
  practiceHref: string;
  redoHref: string;
  backHref?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <section
        aria-labelledby="completed-heading"
        className="animate-fade-slide-up w-full rounded-3xl border-2 border-success/40 bg-success/10 p-6 text-center sm:p-8"
      >
        <div className="relative mx-auto mb-5 flex size-20 items-center justify-center">
          <span aria-hidden="true" className="animate-ring-out absolute inset-0 rounded-full border-2 border-success" />
          <span className="animate-pop-in relative flex size-20 items-center justify-center rounded-full bg-success text-white shadow-[0_6px_0_0_color-mix(in_srgb,var(--success)_70%,black)]">
            <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="animate-draw-check" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        </div>

        <p className="text-sm font-semibold uppercase tracking-wide text-success-ink">Lesson completed</p>
        <h1 id="completed-heading" className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-base text-muted">
          You&apos;ve already finished this one. Feeling confident? Go straight to the exam questions, or go through the lesson again.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          <ButtonLink href={practiceHref} className="w-full sm:w-auto">Go to exam questions</ButtonLink>
          <ButtonLink href={redoHref} variant="secondary" size="compact" className="min-h-11 w-full !shadow-none sm:w-auto">
            Redo the lesson
          </ButtonLink>
          <Link href={backHref} className="inline-flex min-h-11 items-center text-sm font-medium text-muted hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
