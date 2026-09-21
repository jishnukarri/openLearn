import Link from "next/link";
import { ButtonLink } from "@/components/button";
import { roleHome } from "@/lib/roles";
import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";

export default async function NotFound() {
    const session = await getSession();
    const profile = session ? await getProfileByAppwriteId(session.userId) : null;
  return (
    <main className="relative flex min-h-[80dvh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[130px]"
      />
      <div className="relative">
        <p className="animate-fade-slide-up font-[family-name:var(--font-mono)] text-sm font-semibold text-primary">
          404
        </p>
        <h1
          style={{ animationDelay: "80ms" }}
          className="animate-fade-slide-up mt-4 font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-foreground sm:text-6xl"
        >
          Page not found.
        </h1>
        <p
          style={{ animationDelay: "160ms" }}
          className="animate-fade-slide-up mx-auto mt-5 max-w-md text-lg text-muted"
        >
          The page you&apos;re looking for doesn&apos;t exist. It may have
          moved, or the link is incorrect.
        </p>
        <div
          style={{ animationDelay: "240ms" }}
          className="animate-fade-slide-up mt-8 flex items-center justify-center gap-3"
        >
          <ButtonLink href="/">Go back home</ButtonLink>
          <Link
            href={roleHome(profile?.role)}
            className="inline-flex items-center px-4 py-3 text-sm font-medium text-muted hover:text-foreground"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
