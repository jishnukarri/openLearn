# Paper Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher bulk-add platform students (multi-select) and bulk-add custom non-platform students (multi-line names) to a finalized paper's roster, each getting an auto-generated, hand-writable reference code.

**Architecture:** Extends `lib/supabase/papers.ts` and `app/actions/papers.ts` (from the paper-ingestion work shipped earlier this session) with roster CRUD and actions, reusing `lib/supabase/classes.ts`'s exact invite-code generation/collision-retry pattern for reference codes. Replaces the read-only stub on `/teacher/papers/[paperId]` with the real roster UI.

**Tech Stack:** Next.js 16 Server Actions, Supabase (service-role client).

## Global Constraints

- `reference_code` is unique per-paper (DB constraint on `(paper_id, reference_code)`), not globally — different papers may reuse the same code.
- Reference codes use the exact alphabet/length already used for class invite codes (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 6 chars) — no 0/O/1/I ambiguity, since students hand-write/read these.
- Adding students is always an explicit bulk action (multi-select checkboxes for platform students, multi-line textarea for custom students) — never auto-populated.
- Every roster-touching action re-checks `paper.teacherId === profile.id` itself, independent of any prior page-load check — matches this codebase's per-action ownership-check convention.
- Run `npx tsc --noEmit` after each task; it must stay clean throughout.
- No mocking test harness exists in this repo — verify DB-touching code via the Supabase MCP tools against the live project, and the running dev server in the browser, per this session's established convention. Clean up any test data created during verification.

---

### Task 1: Database migration

**Files:** none (Supabase MCP `apply_migration` call)

- [ ] **Step 1: Apply the migration**

```sql
CREATE TABLE public.paper_roster_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id),
  custom_name text,
  reference_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paper_roster_student_or_custom_chk CHECK (
    (student_id IS NOT NULL AND custom_name IS NULL) OR
    (student_id IS NULL AND custom_name IS NOT NULL)
  ),
  CONSTRAINT paper_roster_code_unique_per_paper UNIQUE (paper_id, reference_code)
);

ALTER TABLE public.paper_roster_entries ENABLE ROW LEVEL SECURITY;
```

Apply via the Supabase MCP `apply_migration` tool (project id `cgahkcboiaherxajecys`), name `create_paper_roster_entries`.

- [ ] **Step 2: Verify**

Via the Supabase MCP `execute_sql` tool: `select table_name from information_schema.tables where table_name = 'paper_roster_entries';` — expect one row.
Via the Supabase MCP `get_advisors` tool (type `security`): confirm `paper_roster_entries` appears only as `rls_enabled_no_policy` (INFO), no ERROR-level finding.

---

### Task 2: Data layer — extend `lib/supabase/papers.ts`

**Files:**
- Modify: `lib/supabase/papers.ts`

**Interfaces:**
- Produces: `RosterEntry` type; `addPlatformStudentsToRoster(paperId: string, studentIds: string[]): Promise<RosterEntry[]>`, `addCustomStudentsToRoster(paperId: string, names: string[]): Promise<RosterEntry[]>`, `getRosterForPaper(paperId: string): Promise<Array<RosterEntry & {displayName: string, email: string | null}>>`, `removeRosterEntry(entryId: string): Promise<void>`

- [ ] **Step 1: Append to the file**

```ts
// Appended to lib/supabase/papers.ts

export type RosterEntry = {
  id: string;
  paperId: string;
  studentId: string | null;
  customName: string | null;
  referenceCode: string;
};

// Same unambiguous alphabet as class invite codes (lib/supabase/classes.ts)
// — read aloud/hand-written by students, so no 0/O/1/I confusion.
function generateReferenceCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function insertRosterEntry(
  supabase: ReturnType<typeof createServiceClient>,
  row: { paper_id: string; student_id: string | null; custom_name: string | null }
): Promise<RosterEntry> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("paper_roster_entries")
      .insert({ ...row, reference_code: generateReferenceCode() })
      .select("id, paper_id, student_id, custom_name, reference_code")
      .single();
    if (!error) {
      return {
        id: data.id,
        paperId: data.paper_id,
        studentId: data.student_id,
        customName: data.custom_name,
        referenceCode: data.reference_code,
      };
    }
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique reference code, try again.");
}

// Sequential (not Promise.all) deliberately — each insert needs prior
// collisions resolved before generating the next code; class-sized
// batches make the latency cost negligible.
export async function addPlatformStudentsToRoster(
  paperId: string,
  studentIds: string[]
): Promise<RosterEntry[]> {
  const supabase = createServiceClient();
  const results: RosterEntry[] = [];
  for (const studentId of studentIds) {
    results.push(
      await insertRosterEntry(supabase, { paper_id: paperId, student_id: studentId, custom_name: null })
    );
  }
  return results;
}

export async function addCustomStudentsToRoster(
  paperId: string,
  names: string[]
): Promise<RosterEntry[]> {
  const supabase = createServiceClient();
  const results: RosterEntry[] = [];
  for (const name of names) {
    results.push(
      await insertRosterEntry(supabase, { paper_id: paperId, student_id: null, custom_name: name })
    );
  }
  return results;
}

export async function getRosterForPaper(paperId: string): Promise<
  Array<RosterEntry & { displayName: string; email: string | null }>
> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("paper_roster_entries")
    .select("id, paper_id, student_id, custom_name, reference_code, profiles(full_name, email)")
    .eq("paper_id", paperId)
    .order("created_at");
  if (error) throw error;
  return (data as any[]).map((r) => ({
    id: r.id,
    paperId: r.paper_id,
    studentId: r.student_id,
    customName: r.custom_name,
    referenceCode: r.reference_code,
    displayName: r.custom_name ?? r.profiles?.full_name ?? r.profiles?.email ?? "Unknown",
    email: r.profiles?.email ?? null,
  }));
}

export async function removeRosterEntry(entryId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("paper_roster_entries").delete().eq("id", entryId);
  if (error) throw error;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Verify against the live database**

Using the Supabase MCP `execute_sql` tool and this session's known real teacher (`f1459ea6-a21b-457c-9eef-af628f8a97ee`)/class (`f5afcc92-5580-4c84-b4a5-d4011aa64e20`, "Y11") and a throwaway test paper (create one, matching the pattern from the paper-ingestion verification): insert one platform-student roster row and one custom-student roster row directly, confirm the check constraint rejects a row with both/neither `student_id`/`custom_name` set, confirm the unique-per-paper constraint allows the same code on a *different* paper, then delete all test rows/paper.

---

### Task 3: Action layer — extend `app/actions/papers.ts`

**Files:**
- Modify: `app/actions/papers.ts`

**Interfaces:**
- Consumes: `addPlatformStudentsToRoster`, `addCustomStudentsToRoster`, `removeRosterEntry` from `@/lib/supabase/papers` (Task 2)
- Produces: `addPlatformStudentsAction(formData: FormData): Promise<void>`, `addCustomStudentsAction(formData: FormData): Promise<void>`, `removeRosterEntryAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Update the import and append the actions**

Change the existing import line:

```ts
import { createPaper, replacePaperQuestions, getPaper, markPaperReady } from "@/lib/supabase/papers";
```

to:

```ts
import {
  createPaper,
  replacePaperQuestions,
  getPaper,
  markPaperReady,
  addPlatformStudentsToRoster,
  addCustomStudentsToRoster,
  removeRosterEntry,
} from "@/lib/supabase/papers";
```

Append to the end of the file:

```ts
export async function addPlatformStudentsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  if (typeof paperId !== "string") throw new Error("Missing paperId.");

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  const studentIds = formData.getAll("studentIds").filter((v): v is string => typeof v === "string");
  if (studentIds.length === 0) throw new Error("Select at least one student.");

  await addPlatformStudentsToRoster(paperId, studentIds);
  revalidatePath(`/teacher/papers/${paperId}`);
}

export async function addCustomStudentsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  const namesRaw = formData.get("names");
  if (typeof paperId !== "string" || typeof namesRaw !== "string") {
    throw new Error("Missing paperId or names.");
  }

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  const names = namesRaw
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) throw new Error("Enter at least one student name.");

  await addCustomStudentsToRoster(paperId, names);
  revalidatePath(`/teacher/papers/${paperId}`);
}

export async function removeRosterEntryAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  const entryId = formData.get("entryId");
  if (typeof paperId !== "string" || typeof entryId !== "string") {
    throw new Error("Missing paperId or entryId.");
  }

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  await removeRosterEntry(entryId);
  revalidatePath(`/teacher/papers/${paperId}`);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

### Task 4: UI — roster on the paper detail page

**Files:**
- Modify: `app/teacher/papers/[paperId]/page.tsx`

**Interfaces:**
- Consumes: `getRosterForPaper` from `@/lib/supabase/papers` (Task 2); `listClassMembers` from `@/lib/supabase/classes` (existing); `addPlatformStudentsAction`, `addCustomStudentsAction`, `removeRosterEntryAction` from `@/app/actions/papers` (Task 3); `CopyButton` from `@/components/copy-button` (existing, used for class invite codes)

- [ ] **Step 1: Rewrite the page**

Current file (from the paper-ingestion work):

```tsx
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions } from "@/lib/supabase/papers";

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();
  if (paper.status === "draft") redirect(`/teacher/papers/${paperId}/review`);

  const questions = await getPaperQuestions(paperId);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {questions.length} question{questions.length === 1 ? "" : "s"}, ready to mark.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Question {q.questionNumber} · {q.maxMarks} {q.maxMarks === 1 ? "mark" : "marks"}
            </p>
            <p className="mt-1 text-sm text-foreground">{q.prompt}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

Replace entirely with:

```tsx
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions, getRosterForPaper } from "@/lib/supabase/papers";
import { listClassMembers } from "@/lib/supabase/classes";
import {
  addPlatformStudentsAction,
  addCustomStudentsAction,
  removeRosterEntryAction,
} from "@/app/actions/papers";
import { Button } from "@/components/button";
import { CopyButton } from "@/components/copy-button";

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();
  if (paper.status === "draft") redirect(`/teacher/papers/${paperId}/review`);

  const [questions, roster, classMembers] = await Promise.all([
    getPaperQuestions(paperId),
    getRosterForPaper(paperId),
    listClassMembers(paper.classId, profile.id),
  ]);

  const rosterStudentIds = new Set(roster.map((r) => r.studentId).filter((id): id is string => id !== null));
  const availableMembers = classMembers.filter((m) => !rosterStudentIds.has(m.profileId));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {questions.length} question{questions.length === 1 ? "" : "s"}, ready to mark.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Question {q.questionNumber} · {q.maxMarks} {q.maxMarks === 1 ? "mark" : "marks"}
            </p>
            <p className="mt-1 text-sm text-foreground">{q.prompt}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Roster</h2>

        {availableMembers.length > 0 && (
          <form action={addPlatformStudentsAction} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <input type="hidden" name="paperId" value={paperId} />
            <span className="text-xs font-medium text-foreground">Add students already on the platform</span>
            <div className="flex flex-col gap-1">
              {availableMembers.map((m) => (
                <label key={m.profileId} className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" name="studentIds" value={m.profileId} />
                  {m.fullName ?? m.email}
                </label>
              ))}
            </div>
            <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
              Add selected
            </Button>
          </form>
        )}

        <form action={addCustomStudentsAction} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <input type="hidden" name="paperId" value={paperId} />
          <label htmlFor="names" className="text-xs font-medium text-foreground">
            Add students not on the platform (one name per line)
          </label>
          <textarea
            id="names"
            name="names"
            rows={3}
            placeholder={"Jane Smith\nJohn Doe"}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
            Add custom students
          </Button>
        </form>

        {roster.length > 0 && (
          <div className="flex flex-col gap-1">
            {roster.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium text-foreground">{entry.displayName}</p>
                  {!entry.studentId && <p className="text-[11px] text-muted">Not on the platform</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-xs text-highlight">
                    {entry.referenceCode}
                  </span>
                  <CopyButton text={entry.referenceCode} label="Copy code" />
                  <form action={removeRosterEntryAction}>
                    <input type="hidden" name="paperId" value={paperId} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button type="submit" className="text-xs text-error hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

1. In the browser, confirm `/teacher/papers/<paperId>` (unauthenticated) still redirects cleanly with no server error.
2. Against the live database (Supabase MCP), simulate the full roster flow on a throwaway test paper for the real teacher/class used throughout this session: add 2 platform students (real class members) in one batch, add 2 custom names in one batch, confirm `getRosterForPaper`'s query resolves correct `displayName`s for both kinds, confirm the "already on roster" filter would exclude an added platform student from a second add, remove one entry, then clean up all test rows.

---

## Self-review notes

- **Spec coverage:** all 4 spec goals (bulk platform add, bulk custom add, auto-generated codes, view/copy/remove) map to Tasks 1-4.
- **Type consistency:** `RosterEntry` (Task 2) is used identically in Task 3's action signatures and Task 4's `roster`/`entry` usage; `getRosterForPaper`'s returned `displayName`/`email` fields match exactly what Task 4's JSX reads.
- **No placeholders:** every step has complete code, including the full before/after of the modified detail page (Task 4) rather than a diff description.
