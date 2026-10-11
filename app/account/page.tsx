import { Flame } from "lucide-react";
import { requireSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { PageShell, PageHeader, AsideBlock } from "@/components/page-shell";
import { UpdateNameForm } from "./update-name-form";
import { DeleteAccountForm } from "./delete-account-form";

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

      <section
        className="animate-fade-slide-up flex max-w-md flex-col gap-3 border-t border-error/30 pt-6"
        style={{ animationDelay: "160ms" }}
      >
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-error">Danger zone</h2>
        <DeleteAccountForm />
      </section>
    </PageShell>
  );
}
