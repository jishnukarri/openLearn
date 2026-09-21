import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/button";
import { getSession } from "@/lib/appwrite/session";
import { roleHome } from "@/lib/roles";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";

// Flat categorical colours (matching the subject cards on /dashboard), not
// brand accent tokens — indigo/coral/amber each have one job (chrome,
// celebration, XP) and a topic-identity swatch isn't any of those.
const TOPICS = [
  { title: "Ionic Bonding", subject: "Chemistry", color: "#0f766e", xp: 40 },
  { title: "Cell Division", subject: "Biology", color: "#be123c", xp: 35 },
  { title: "Quadratics", subject: "Maths", color: "#1d4ed8", xp: 50 },
];

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
            Revise chemistry, biology and maths against your exam board&apos;s own markscheme.
          </h1>
          <p
            style={{ animationDelay: "100ms" }}
            className="animate-fade-slide-up mx-auto mt-5 max-w-md text-lg text-muted"
          >
            AI-built lessons, tests and revision, marked strictly to your
            exam board&apos;s own markscheme.
          </p>
          <div
            style={{ animationDelay: "200ms" }}
            className="animate-fade-slide-up mt-8 flex flex-col items-center gap-3"
          >
            <ButtonLink href="/signup">Join now</ButtonLink>
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
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Pick up a topic
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TOPICS.map((topic) => (
            <div
              key={topic.title}
              className="group rounded-2xl border border-border bg-surface p-5 transition-[transform,border-color] hover:-translate-y-1 hover:border-primary/40"
            >
              <div
                className="h-9 w-9 rounded-lg"
                style={{ backgroundColor: topic.color }}
              />
              <p className="mt-4 font-display text-lg font-semibold text-foreground">
                {topic.title}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted">{topic.subject}</span>
                <span className="font-mono text-highlight">
                  +{topic.xp} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
