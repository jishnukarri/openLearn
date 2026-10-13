import { requireRole } from "@/lib/appwrite/session";
import { listBlocklist, type BlocklistEntry } from "@/lib/supabase/blocklist";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { BlocklistForm } from "./blocklist-form";
import { RemoveBlockButton } from "./remove-button";

export default async function AdminBlocklistPage() {
  await requireRole("admin");

  let entries: BlocklistEntry[] = [];
  let unavailable = false;
  try {
    entries = await listBlocklist();
  } catch {
    unavailable = true;
  }

  return (
    <PageShell
      size="fluid"
      aside={
        <AsideBlock title="How it works">
          <p>People matching the blocklist can't create an account or change their name to a blocked one.</p>
          <p>Existing accounts can still sign in. Blocking is checked only when someone signs up or edits their name.</p>
          <p>Matching ignores capital letters, accents, and Gmail dots or +tags. Block a whole school domain: @example.com</p>
        </AsideBlock>
      }
    >
      <PageHeader
        title="Blocklist"
        description="Stop certain emails, school domains, or names from being used on new accounts."
      />

      <section className="flex max-w-xl flex-col gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          Add to the blocklist
        </h2>
        <BlocklistForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          Currently blocked ({entries.length})
        </h2>
        {unavailable ? (
          <p className="text-base text-muted">
            The blocklist can't be loaded right now. Ask your developer to check that it has been set up.
          </p>
        ) : entries.length === 0 ? (
          <p className="text-base text-muted">Nothing is blocked yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="break-all text-base font-semibold text-foreground">
                    <span className="mr-2 rounded border border-border bg-surface px-1.5 py-0.5 text-sm font-normal text-muted">
                      {e.kind === "email" ? "Email" : "Name"}
                    </span>
                    {e.pattern}
                  </p>
                  <p className="text-sm text-muted">
                    Added {new Date(e.createdAt).toLocaleDateString()}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <RemoveBlockButton id={e.id} label={e.pattern} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
