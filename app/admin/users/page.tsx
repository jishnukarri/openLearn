import { requireRole } from "@/lib/appwrite/session";
import { listProfiles } from "@/lib/supabase/admin-users";
import { updateRoleAction } from "@/app/actions/admin-users";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { DeleteUserButton } from "./delete-user-button";

const ROLES = ["student", "teacher", "admin"] as const;

export default async function AdminUsersPage() {
  const { profile: currentAdmin } = await requireRole("admin");
  const profiles = await listProfiles();

  const pending = profiles.filter((p) => p.role === "pending_teacher");
  const rest = profiles.filter((p) => p.role !== "pending_teacher");
  const roleCounts = {
    student: profiles.filter((p) => p.role === "student").length,
    teacher: profiles.filter((p) => p.role === "teacher").length,
    admin: profiles.filter((p) => p.role === "admin").length,
  };

  const roster = [
    ["Students", roleCounts.student],
    ["Teachers", roleCounts.teacher],
    ["Admins", roleCounts.admin],
  ] as const;

  return (
    <PageShell
      size="wide"
      aside={
        <>
          <AsideBlock title="Roster breakdown">
            <dl className="flex flex-col gap-2">
              {roster.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <dt>{label}</dt>
                  <dd className="font-[family-name:var(--font-mono)] text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </AsideBlock>
          <AsideBlock title={pending.length > 0 ? "Needs review" : "All caught up"}>
            <p>
              {pending.length > 0
                ? `${pending.length} teacher ${pending.length === 1 ? "account is" : "accounts are"} waiting on approval.`
                : "No teacher approvals waiting right now."}
            </p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title="Accounts"
        description={`${profiles.length} ${profiles.length === 1 ? "account" : "accounts"}`}
      />

      <Stagger className="flex flex-col gap-8">
        {pending.length > 0 && (
          <Rise className="flex flex-col gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
              Pending teacher approval ({pending.length})
            </h2>
            <ul className="flex flex-col divide-y divide-highlight/30 rounded-xl border border-highlight/40 bg-highlight/10">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.full_name ?? p.email}
                    </p>
                    <p className="truncate text-sm text-muted">{p.email}</p>
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
                </li>
              ))}
            </ul>
          </Rise>
        )}

        <Rise>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {rest.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.full_name ?? p.email}
                  </p>
                  <p className="truncate text-sm text-muted">{p.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <form action={updateRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="profileId" value={p.id} />
                    <select
                      name="role"
                      defaultValue={p.role}
                      aria-label={`Role for ${p.full_name ?? p.email}`}
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
              </li>
            ))}
          </ul>
        </Rise>
      </Stagger>
    </PageShell>
  );
}
