import { requireSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { UpdateNameForm } from "./update-name-form";
import { DeleteAccountForm } from "./delete-account-form";

export default async function AccountPage() {
  const session = await requireSession();
  const profile = await getProfileByAppwriteId(session.userId);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-muted">{session.email}</p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <UpdateNameForm currentName={profile?.full_name ?? session.name} />
        <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted">Role</span>
          <span className="rounded-full border border-border px-3 py-1 text-xs capitalize text-foreground">
            {profile?.role ?? "student"}
          </span>
        </div>
        {profile && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Progress</span>
            <span className="font-[family-name:var(--font-mono)] text-highlight">
              {profile.xp} XP · 🔥 {profile.streak_count}
            </span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-error/30 bg-surface p-6">
        <h2 className="text-sm font-semibold text-error">Danger zone</h2>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
