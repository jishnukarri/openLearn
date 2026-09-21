import { requireRole } from "@/lib/appwrite/session";
import { listProfiles } from "@/lib/supabase/admin-users";
import { updateRoleAction } from "@/app/actions/admin-users";
import { Button } from "@/components/button";
import { DeleteUserButton } from "./delete-user-button";

const ROLES = ["student", "teacher", "admin"] as const;

export default async function AdminUsersPage() {
  const { profile: currentAdmin } = await requireRole("admin");
  const profiles = await listProfiles();

  const pending = profiles.filter((p) => p.role === "pending_teacher");
  const rest = profiles.filter((p) => p.role !== "pending_teacher");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Accounts
        </h1>
        <p className="mt-1 text-sm text-muted">
          {profiles.length} {profiles.length === 1 ? "account" : "accounts"}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-highlight">
            Pending teacher approval ({pending.length})
          </h2>
          {pending.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-highlight/40 bg-highlight/10 p-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {p.full_name ?? p.email}
                </p>
                <p className="text-xs text-muted">{p.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <form action={updateRoleAction}>
                  <input type="hidden" name="profileId" value={p.id} />
                  <input type="hidden" name="role" value="teacher" />
                  <Button type="submit" size="compact" className="!shadow-none">
                    Approve
                  </Button>
                </form>
                <form action={updateRoleAction}>
                  <input type="hidden" name="profileId" value={p.id} />
                  <input type="hidden" name="role" value="student" />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                    Reject
                  </Button>
                </form>
                <DeleteUserButton profileId={p.id} label={p.full_name ?? p.email} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rest.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {p.full_name ?? p.email}
              </p>
              <p className="text-xs text-muted">{p.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <form action={updateRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="profileId" value={p.id} />
                <select
                  name="role"
                  defaultValue={p.role}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                  Save
                </Button>
              </form>
              {p.id !== currentAdmin.id && (
                <DeleteUserButton profileId={p.id} label={p.full_name ?? p.email} />
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
