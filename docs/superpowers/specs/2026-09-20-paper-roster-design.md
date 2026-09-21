# Paper roster building (sub-project 2 of 4)

## Context

Second of four sequential paper-marking pipeline stages: (1) paper ingestion — shipped this session, (2) roster building (this spec), (3) bulk answer upload + AI splitting + marking, (4) feedback delivery via shareable links.

## Problem

A finalized ("ready") paper has questions but no way to identify whose answer script is whose once a bulk batch of scanned student work is uploaded (stage 3). Each student needs a short reference code to write on their paper (or have it pre-printed) so the AI splitting step in stage 3 can group pages by student. Some students use the platform (real accounts, real class membership); others don't (a teacher grading printed papers wants to include students who never signed up).

## Goals

1. A teacher can bulk-select several of the class's real (platform) students at once and generate a reference code for each in one action.
2. A teacher can bulk-add several custom (non-platform) students by name at once and generate a reference code for each.
3. Every roster entry's code is short, easy to hand-write, and safe to read aloud (reusing the exact alphabet/length already used for class invite codes) — auto-generated, not typed by the teacher.
4. The teacher can see and copy every code, and remove an entry (a student absent on the day, or added by mistake).

## Non-goals

- Auto-populating the whole class automatically — explicitly rejected; adding is always an explicit bulk action, never automatic.
- Collecting contact info (email, etc.) for custom students — out of scope; stage 4 (sharing) works by the teacher copying and distributing a link however they choose, not by this app sending anything on their behalf.
- Printing/exporting a physical paper with codes pre-filled — the teacher writes/reads codes out to students by whatever means they already use; generating a printable code sheet is a reasonable future enhancement, not in scope here.

## Design

### Data model

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
-- No policies — matches papers/paper_questions and every other table in
-- this app; authorization is enforced in the Server Action layer.
```

`reference_code` is unique per-paper (not globally) — different papers can safely reuse the same 6-character code, keeping the same small alphabet/length as class invite codes without needing a larger global namespace.

### Data layer — extend `lib/supabase/papers.ts`

Reuses the exact `generateInviteCode`/collision-retry pattern from `lib/supabase/classes.ts`'s `createClass`, adapted to per-paper uniqueness:

```ts
// Added to lib/supabase/papers.ts

export type RosterEntry = {
  id: string;
  paperId: string;
  studentId: string | null;
  customName: string | null;
  referenceCode: string;
};

function generateReferenceCode(): string {
  // Same unambiguous alphabet as class invite codes (lib/supabase/classes.ts)
  // — read aloud/hand-written by students, so no 0/O/1/I confusion.
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

export async function addPlatformStudentsToRoster(
  paperId: string,
  studentIds: string[]
): Promise<RosterEntry[]> {
  const supabase = createServiceClient();
  const results: RosterEntry[] = [];
  for (const studentId of studentIds) {
    results.push(await insertRosterEntry(supabase, { paper_id: paperId, student_id: studentId, custom_name: null }));
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
    results.push(await insertRosterEntry(supabase, { paper_id: paperId, student_id: null, custom_name: name }));
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

`insertRosterEntry` loops sequentially (not `Promise.all`) per call in `addPlatformStudentsToRoster`/`addCustomStudentsToRoster` deliberately — each insert needs to see prior collisions resolved before generating the next code, and per-paper collision odds are low enough that sequential inserts for a class-sized batch (dozens, not thousands) cost negligible latency, consistent with this codebase's existing preference for sequential-when-safer over parallel (e.g. `app/actions/topic-documents.ts`'s sequential file processing).

### Action layer — extend `app/actions/papers.ts`

```ts
// Added to app/actions/papers.ts

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

Each action re-checks `paper.teacherId === profile.id` independently (not just once at page load) since these are separate Server Action invocations — matches this codebase's ownership-check-per-action convention throughout (e.g. every `app/actions/subjects.ts` mutation re-checks ownership itself, never trusts a prior page load).

### UI — replaces the read-only stub in `app/teacher/papers/[paperId]/page.tsx`

Now shows, in order: the question list (from stage 1, unchanged), then a roster section:

- **Add platform students**: a checkbox list of `listClassMembers(paper.classId, teacherId)` results, filtered to exclude students already on the roster (so the same student can't be double-added — checked by `studentId` membership in the existing roster). Submits checked `studentIds[]` to `addPlatformStudentsAction`.
- **Add custom students**: a `<textarea>` (one name per line) submitting to `addCustomStudentsAction`.
- **Roster table**: every entry so far — display name, reference code (with the existing `CopyButton` component, same as class invite codes), and a "Remove" form per row calling `removeRosterEntryAction`.

### Testing

- `addPlatformStudentsToRoster`/`addCustomStudentsToRoster` with multiple ids/names in one call create one roster entry per input, each with a distinct reference code.
- Reference code collision retry: verified conceptually via the identical pattern already proven for class invite codes (`createClass`'s retry loop) — not re-verified from scratch, since it's the same code shape with the same collision math (32^6 keyspace, per-paper not per-class scoping only shrinks the practical collision surface further).
- `getRosterForPaper` resolves a platform student's `displayName` from their profile and a custom student's from `custom_name`, never confusing the two.
- The UI never offers a student already on the roster in the "add platform students" checkbox list — verified manually via the browser, since this is a display-filtering behavior, not something meaningfully unit-testable without the DOM.
- Ownership: an action invoked with a `paperId` belonging to a different teacher throws "Paper not found." before touching the roster.
