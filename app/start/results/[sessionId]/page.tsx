import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { getGuestToken } from "@/lib/guest-session";
import { isGuestSessionOwner, getSessionResultsByTopic } from "@/lib/supabase/diagnostic";
import { ButtonLink } from "@/components/button";

export default async function GuestResultsTeaserPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const guestToken = await getGuestToken();
  if (!guestToken || !(await isGuestSessionOwner(sessionId, guestToken))) notFound();

  const results = await getSessionResultsByTopic(sessionId);
  const strongCount = results.filter((r) => r.score >= 0.6).length;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16 text-center">
      <div className="animate-fade-slide-up">
        <p className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wide text-primary">
          Diagnostic complete
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          You&apos;re strong in {strongCount} of {results.length}{" "}
          {results.length === 1 ? "topic" : "topics"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Create a free account to see exactly which ones, and start your
          personalised revision plan.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div aria-hidden className="flex flex-col gap-3 blur-sm select-none">
          {results.map((r) => (
            <div key={r.topicName} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{r.topicName}</span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full ${r.score >= 0.6 ? "bg-success" : "bg-error"}`}
                  style={{ width: `${Math.round(r.score * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
          <p className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted">
            <Lock className="size-3.5" strokeWidth={2} />
            Sign up to reveal your full results
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <ButtonLink href="/signup">Join now, it&apos;s free</ButtonLink>
        <ButtonLink
          href="/login"
          variant="secondary"
          size="compact"
          className="!shadow-none !bg-transparent text-muted hover:text-foreground"
        >
          Already have an account? Log in
        </ButtonLink>
      </div>
    </main>
  );
}
