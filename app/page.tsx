import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/button";
import { getSession } from "@/lib/appwrite/session";
import { roleHome } from "@/lib/roles";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { MarkupDemo } from "@/components/markup-demo";

export default async function Home() {
  const session = await getSession();
  if (session) {
    const profile = await getProfileByAppwriteId(session.userId);
    redirect(roleHome(profile?.role));
  }

  return (
    <main className="flex flex-col">
      <section className="relative overflow-hidden px-6 pb-20 pt-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-105 w-160 -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/25 blur-[130px]"
        />
        <div className="relative mx-auto max-w-2xl">
          <h1 className="animate-fade-slide-up font-display text-5xl font-semibold leading-snug tracking-tight text-foreground sm:text-6xl">
            Revise chemistry, biology and maths, marked like a real teacher marked it.
          </h1>
          <p
            style={{ animationDelay: "100ms" }}
            className="animate-fade-slide-up mx-auto mt-5 max-w-md text-lg text-muted"
          >
            AI-built lessons, tests and revision, with feedback annotated
            directly onto your own answer, not just a score.
          </p>
          <div
            style={{ animationDelay: "200ms" }}
            className="animate-fade-slide-up mt-8 flex flex-col items-center gap-3"
          >
            <ButtonLink href="/start">Join now</ButtonLink>
            <ButtonLink
              href="/login"
              variant="secondary"
              size="compact"
              className="!shadow-none !bg-transparent text-muted hover:text-foreground"
            >
              Already have an account? Log in
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            See it mark a real answer
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            Every answer gets marked point-by-point against the exam
            board&apos;s markscheme, strikethrough and all, not a generic
            AI guess.
          </p>
        </div>
        <MarkupDemo />
      </section>

      <section className="border-t border-border bg-surface px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          Ready to see your own work marked this way?
        </h2>
        <div className="mt-6 flex flex-col items-center gap-3">
          <ButtonLink href="/start">Join now</ButtonLink>
          <ButtonLink
            href="/login"
            variant="secondary"
            size="compact"
            className="!shadow-none !bg-transparent text-muted hover:text-foreground"
          >
            Already have an account? Log in
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
