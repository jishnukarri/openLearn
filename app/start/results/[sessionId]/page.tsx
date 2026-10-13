import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { getGuestToken } from "@/lib/guest-session";
import { isGuestSessionOwner, getSessionResultsByTopic } from "@/lib/supabase/diagnostic";
import { convertGuestSessionToStudent } from "@/lib/guest-diagnostic";
import { ButtonLink } from "@/components/button";
import { BrandMark } from "@/components/brand-mark";
import { Rise, Stagger } from "@/components/motion";

export default async function GuestResultsTeaserPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const guestToken = await getGuestToken();
  if (!guestToken || !(await isGuestSessionOwner(sessionId, guestToken))) notFound();

  // A visitor can log into an existing account without ever going through
  // signup's guest-conversion step (e.g. the "Already have an account? Log
  // in" link below) — without this check they'd stay stuck behind the
  // locked teaser forever, logged in but never actually get their results.
  const session = await getSession();
  if (session) {
    const profile = await getProfileByAppwriteId(session.userId);
    if (profile?.role === "student") {
      await convertGuestSessionToStudent(sessionId, profile.id);
      // Not clearing the guest cookie here — cookies can only be mutated in
      // a Server Action/Route Handler, not during a page render. Harmless
      // to leave it: the session's status is now "converted", so
      // getActiveGuestSession's `status = active` filter will never pick
      // it back up, and the cookie itself just expires after 2 days.
      redirect(`/onboarding/diagnostic/${sessionId}/results`);
    }
  }

  const results = await getSessionResultsByTopic(sessionId);
  const strongCount = results.filter((r) => r.score >= 0.6).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 lg:py-16">
      <Stagger className="grid gap-x-20 gap-y-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex flex-col items-start gap-5">
          <Rise>
            <BrandMark size={44} />
          </Rise>
          <Rise>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl lg:leading-[1.1]">
              You&apos;re strong in {strongCount} of {results.length}{" "}
              {results.length === 1 ? "topic" : "topics"}
            </h1>
          </Rise>
          <Rise>
            <p className="max-w-[56ch] text-base text-muted">
              Diagnostic complete. Create a free account to see exactly which
              ones, and start your personalised revision plan.
            </p>
          </Rise>
          <Rise className="flex flex-col items-start gap-3">
            <ButtonLink href="/signup">Join now, it&apos;s free</ButtonLink>
            <ButtonLink
              href="/login"
              variant="secondary"
              size="compact"
              className="!shadow-none !bg-transparent text-muted hover:text-foreground"
            >
              Already have an account? Log in
            </ButtonLink>
          </Rise>
          <Rise>
            <p className="max-w-[56ch] text-sm text-muted">
              Already covered some topics at school? After you sign up, you can tell us which ones and we&apos;ll check what you know.
            </p>
          </Rise>
        </div>

        <Rise className="relative">
          <ul aria-hidden className="flex select-none flex-col divide-y divide-border border-y border-border blur-sm">
            {results.map((r) => (
              <li key={r.topicName} className="flex items-center justify-between gap-4 py-4">
                <span className="text-base font-medium text-foreground">{r.topicName}</span>
                <div className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full ${r.score >= 0.6 ? "bg-success" : "bg-error"}`}
                    style={{ width: `${Math.round(r.score * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted">
              <Lock className="size-4" strokeWidth={2} />
              Sign up to reveal your full results
            </p>
          </div>
        </Rise>
      </Stagger>
    </main>
  );
}
