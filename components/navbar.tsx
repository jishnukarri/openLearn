import { Logo } from "./logo";
import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { logout } from "@/app/actions/auth";
import { roleHome } from "@/lib/roles";

export async function NavBar() {
  const session = await getSession();
  const profile = session ? await getProfileByAppwriteId(session.userId) : null;
  // Logged in: the logo is the "home" affordance, going to the user's role
  // home (not the marketing "/") — no separate "Home" link needed.
  // Logged out: "/" is the only home there is.
  const logoHref = session ? roleHome(profile?.role) : "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 [body:has([data-fluid])_&]:max-w-none lg:[body:has([data-fluid])_&]:px-10">
        <a
          href={logoHref}
          className="shrink-0 [&_svg]:h-6 [&_svg]:w-auto sm:[&_svg]:h-[45px] sm:[&_svg]:w-[272px]"
        >
          <Logo className="text-foreground" />
        </a>

        {/* Logged-out visitors get no "Join now" clutter here — that CTA
            stays exclusive to the landing hero. But a bare "Log in" link
            stays present everywhere, so a visitor who lands anywhere other
            than "/" (a shared link, a 404, mid-onboarding) is never stuck
            without a way back into their account. */}
        {session ? (
          <nav className="flex min-w-0 items-center gap-1 text-sm font-medium text-foreground">
            <details className="group relative">
              <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-2 transition-colors hover:border-primary sm:pr-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                  {session.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden truncate sm:inline">{session.name}</span>
              </summary>
              <div className="absolute right-0 top-[calc(100%+8px)] flex w-48 flex-col overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-2xl shadow-black/30">
                <a
                  href={roleHome(profile?.role)}
                  className="px-4 py-2 text-sm text-foreground hover:bg-background"
                >
                  Dashboard
                </a>
                <a
                  href="/account"
                  className="px-4 py-2 text-sm text-foreground hover:bg-background"
                >
                  Account settings
                </a>
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 text-left text-sm text-error hover:bg-background"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </details>
          </nav>
        ) : (
          <a
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            Log in
          </a>
        )}
      </div>
    </header>
  );
}
