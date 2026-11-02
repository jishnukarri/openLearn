import { Flame } from "lucide-react";
import { requireSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { PageShell, PageHeader, AsideBlock } from "@/components/page-shell";
import { UpdateNameForm } from "./update-name-form";
import { DeleteAccountForm } from "./delete-account-form";
import { ThemeChoiceGroup } from "@/components/theme-toggle";

export default async function AccountPage() {
  const session = await requireSession();
  const profile = await getProfileByAppwriteId(session.userId);

  return (
    <PageShell
      size="form"
      aside={
        profile && (
          <AsideBlock title="Your progress">
            <p className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-base text-highlight">
              {profile.xp} XP · <Flame className="size-4 text-secondary" strokeWidth={2} /> {profile.streak_count}
            </p>
            <p>Your progress is deleted along with the account.</p>
          </AsideBlock>
        )
      }
    >
      <PageHeader title="Account settings" description={session.email} />

      <section className="animate-fade-slide-up flex max-w-md flex-col gap-5" style={{ animationDelay: "80ms" }}>
        <UpdateNameForm currentName={profile?.full_name ?? session.name} />
        <div className="flex items-center justify-between border-t border-border pt-5 text-sm">
          <span className="text-muted">Role</span>
          <span className="rounded-full border border-border px-3 py-1 text-sm capitalize text-foreground">
            {profile?.role ?? "student"}
          </span>
        </div>
      </section>

      <section className="animate-fade-slide-up flex max-w-2xl flex-col gap-3" style={{ animationDelay: "120ms" }}>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Appearance</h2>
        <ThemeChoiceGroup />
        <p className="text-sm text-muted">Saved on this device.</p>
      </section>

      <section className="animate-fade-slide-up flex max-w-md flex-col gap-3" style={{ animationDelay: "140ms" }}>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Password</h2>
        <a
          href="/account/password"
          className="inline-flex min-h-11 w-fit items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:border-primary"
        >
          Change password
        </a>
      </section>

      <section className="animate-fade-slide-up flex max-w-md flex-col gap-3" style={{ animationDelay: "150ms" }}>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Your data</h2>
        <p className="text-sm text-muted">
          Download everything we hold about you, or read how it is used in the{" "}
          <a href="/privacy" className="font-medium text-primary hover:underline">privacy notice</a>.
        </p>
        <a
          href="/account/export"
          download
          className="inline-flex min-h-11 w-fit items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:border-primary"
        >
          Download my data
        </a>
      </section>

      <section
        className="animate-fade-slide-up flex max-w-md flex-col gap-3 border-t border-error/30 pt-6"
        style={{ animationDelay: "160ms" }}
      >
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-error-ink">Danger zone</h2>
        <DeleteAccountForm />
      </section>
    </PageShell>
  );
}
