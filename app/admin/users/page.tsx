import { requireRole } from "@/lib/appwrite/session";
import Link from "next/link";
import { listProfiles, countProfilesByRole, type ProfileRoleFilter } from "@/lib/supabase/admin-users";
import { updateRoleAction } from "@/app/actions/admin-users";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { DeleteUserButton } from "./delete-user-button";

const ROLES = ["student", "teacher", "admin"] as const;

const PAGE_SIZE = 25;
const FILTERS = ["student", "teacher", "admin", "pending_teacher"] as const;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function formatLastActive(d: string | null): string {
  if (!d) return "Never";
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? "Never"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile: currentAdmin } = await requireRole("admin");
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 80);
  const roleParam = first(sp.role);
  const role = (FILTERS as readonly string[]).includes(roleParam)
    ? (roleParam as ProfileRoleFilter)
    : undefined;
  const requestedPage = Math.max(1, parseInt(first(sp.page), 10) || 1);

  const [{ rows: profiles, total }, roleCounts, pendingResult] = await Promise.all([
    listProfiles({ q, role, page: requestedPage, pageSize: PAGE_SIZE }),
    countProfilesByRole(),
    listProfiles({ role: "pending_teacher", pageSize: 100 }),
  ]);

  const pending = pendingResult.rows;
  const rest = profiles.filter((p) => p.role !== "pending_teacher" || role === "pending_teacher" || Boolean(q));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const allCount = roleCounts.student + roleCounts.teacher + roleCounts.admin + roleCounts.pending_teacher;

  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  const roster = [
    ["Students", roleCounts.student],
    ["Teachers", roleCounts.teacher],
    ["Admins", roleCounts.admin],
  ] as const;

  return (
    <PageShell
      size="fluid"
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
        description={`${allCount} ${allCount === 1 ? "account" : "accounts"}`}
      />

      <Stagger className="flex flex-col gap-8">
        {pending.length > 0 && !q && !role && (
          <Rise className="flex flex-col gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
              Pending teacher approval ({pending.length})
            </h2>
            <ul className="flex flex-col divide-y divide-highlight/30 rounded-xl border border-highlight/40 bg-highlight/10">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${p.id}`}
                      className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {p.full_name ?? p.email}
                    </Link>
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

        <Rise className="flex flex-col gap-4">
          <form method="get" action="/admin/users" role="search" className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm text-muted">
              Search name or email
              <input
                type="search"
                name="q"
                defaultValue={q}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Role
              <select
                name="role"
                defaultValue={role ?? ""}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">All roles</option>
                {FILTERS.map((r) => (
                  <option key={r} value={r}>
                    {r === "pending_teacher" ? "pending teacher" : r}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
              Search
            </Button>
            {(q || role) && (
              <Link href="/admin/users" className="py-2 text-sm text-muted underline">
                Clear
              </Link>
            )}
          </form>
          <p className="text-sm text-muted" aria-live="polite">
            {total} {total === 1 ? "match" : "matches"}
          </p>
          {rest.length === 0 && <p className="text-sm text-muted">No accounts match these filters.</p>}
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {rest.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/users/${p.id}`}
                    className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {p.full_name ?? p.email}
                  </Link>
                  <p className="truncate text-sm text-muted">{p.email}</p>
                  <p className="text-sm text-muted">Last active: {formatLastActive(p.last_active_date)}</p>
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
          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={hrefFor(page - 1)} className="underline">
                  Previous
                </Link>
              ) : (
                <span className="text-muted">Previous</span>
              )}
              <span className="text-muted">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={hrefFor(page + 1)} className="underline">
                  Next
                </Link>
              ) : (
                <span className="text-muted">Next</span>
              )}
            </nav>
          )}
        </Rise>
      </Stagger>
    </PageShell>
  );
}
