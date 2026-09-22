import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { roleHome } from "@/lib/roles";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { getGuestToken } from "@/lib/guest-session";
import { getActiveGuestSession } from "@/lib/supabase/diagnostic";
import { startGuestDiagnosticAction, resetGuestSessionAction } from "@/app/actions/guest";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export default async function StartPage() {
  // Already have an account — no guest flow needed, straight to your role home.
  const session = await getSession();
  if (session) {
    const profile = await getProfileByAppwriteId(session.userId);
    redirect(roleHome(profile?.role));
  }

  const [subjects, guestToken] = await Promise.all([listPublishedSubjects(), getGuestToken()]);
  const activeSession = guestToken ? await getActiveGuestSession(guestToken) : null;

  if (activeSession) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16 text-center">
        <div className="animate-fade-slide-up">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted">
            You started a diagnostic earlier — want to pick up where you left off?
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Link
            href={`/start/diagnostic/${activeSession.id}/level/0`}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-[0_4px_0_0_#39369a] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
          >
            Continue where I left off
          </Link>
          <form action={resetGuestSessionAction}>
            <input type="hidden" name="sessionId" value={activeSession.id} />
            <button type="submit" className="text-xs text-muted underline hover:text-foreground">
              Start over instead
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <div className="animate-fade-slide-up">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Pick your subjects
        </h1>
        <p className="mt-1 text-sm text-muted">
          No account needed yet — take a short diagnostic first, see how you
          do, then decide.
        </p>
      </div>

      <section className="animate-fade-slide-up flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        {subjects.length === 0 ? (
          <p className="text-sm text-muted">No subjects have been published yet, check back soon.</p>
        ) : (
          <form action={startGuestDiagnosticAction} className="flex flex-col gap-4">
            <FieldGroup className="gap-2">
              {subjects.map((subject) => {
                const id = `subject-${subject.id}`;
                return (
                  <Field
                    key={subject.id}
                    orientation="horizontal"
                    className="rounded-lg border border-border bg-background px-3 py-2 has-[[data-checked]]:border-primary"
                  >
                    <Checkbox id={id} name="subjectIds" value={subject.id} />
                    <FieldLabel htmlFor={id} className="cursor-pointer text-sm text-foreground">
                      {subject.name}
                    </FieldLabel>
                  </Field>
                );
              })}
            </FieldGroup>
            <Button type="submit" className="self-start">
              Start the diagnostic
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
