# Teacher Subject Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers create and fully manage their own subjects/topics/subtopics using the same tooling admin has, while admin-owned subjects stay locked to teachers.

**Architecture:** Reuse the existing admin subject-management UI and Server Actions. Swap the hard `requireRole("admin")` gates for a new `requireOwnerOrAdmin(subjectId)` check that passes for admins unconditionally and for teachers only when they own the subject (`subjects.created_by === profile.id`). Parameterize the two admin-only UI pieces (the subject grid's "manage" link, and the subject detail page's back-link/board-links) with a `basePath` so the same components mount at both `/admin/subjects/...` and new `/teacher/subjects/...` routes.

**Tech Stack:** Next.js 16 Server Actions, Supabase (service-role client, no direct client access), Appwrite session cookies, Vitest for pure-function unit tests.

## Global Constraints

- Authorization is enforced entirely in Server Actions / page loaders — this app's Supabase access is service-role-only, RLS is deny-by-default and not a security boundary here (see `lib/appwrite/session.ts`).
- A locked/mismatched resource 404s (`notFound()`), never redirects or shows an "access denied" message — this project's existing convention (see `requireRole`/`requireAnyRole` in `lib/appwrite/session.ts`) is that a wrong role/ownership shouldn't reveal a resource exists.
- This repo has no DB/session mocking test harness — existing Vitest tests (`lib/question-marking.test.ts`, `lib/lesson-sanitize.test.ts`) cover pure functions only. Follow that pattern: extract pure, testable logic where possible; verify DB/auth-touching code manually via the dev server (browser) instead of fabricating a mocking layer.
- Run `npm test` (vitest) for unit tests and `npx tsc --noEmit` for type-checking after each task.

---

### Task 1: Expose `created_by` on Subject/SubjectSummary + add owner-scoped listing

**Files:**
- Modify: `lib/supabase/subjects.ts`

**Interfaces:**
- Produces: `Subject.created_by: string`, `SubjectSummary.created_by: string`, `listSubjectSummariesByOwner(ownerId: string): Promise<SubjectSummary[]>`

- [ ] **Step 1: Add `created_by` to the `Subject` type and `SUBJECT_COLUMNS`**

In `lib/supabase/subjects.ts`, update the type and column list:

```ts
export type Subject = {
  id: string;
  name: string;
  status: "draft" | "published";
  created_at: string;
  created_by: string;
  custom_instructions: string | null;
  archetype: SubjectArchetype | null;
  exam_boards: ExamBoard[];
};

const SUBJECT_COLUMNS =
  "id, name, status, created_at, created_by, custom_instructions, archetype, subject_exam_boards(exam_boards(id, name))";
```

And in `mapSubject`, add `created_by: data.created_by,` alongside the other fields.

- [ ] **Step 2: Add `created_by` to `SubjectSummary` and `listSubjectSummaries`, add `listSubjectSummariesByOwner`**

```ts
export type SubjectSummary = {
  id: string;
  name: string;
  status: "draft" | "published";
  created_at: string;
  created_by: string;
  exam_boards: ExamBoard[];
  topicCount: number;
};

export async function listSubjectSummaries(): Promise<SubjectSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any[]).map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    created_at: d.created_at,
    created_by: d.created_by,
    exam_boards: d.subject_exam_boards.flatMap((row: any) => row.exam_boards),
    topicCount: (d.topics as any[]).length,
  }));
}

// Same shape as listSubjectSummaries, scoped to subjects a specific teacher
// owns — powers /teacher/subjects, which must never show admin-owned or
// other teachers' subjects.
export async function listSubjectSummariesByOwner(ownerId: string): Promise<SubjectSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id)")
    .eq("created_by", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any[]).map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    created_at: d.created_at,
    created_by: d.created_by,
    exam_boards: d.subject_exam_boards.flatMap((row: any) => row.exam_boards),
    topicCount: (d.topics as any[]).length,
  }));
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/supabase/subjects.ts`. (The pre-existing `block-sort.tsx` errors are unrelated — ignore them.)

- [ ] **Step 4: Verify against the live database**

Confirm `subjects.created_by` is already populated for existing rows (the admin `createSubjectAction` already sets it): via the Supabase MCP `execute_sql` tool, run `select id, created_by from public.subjects limit 5;` and confirm no nulls.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/subjects.ts
git commit -m "feat: expose created_by on subjects, add owner-scoped listing"
```

---

### Task 2: Add `canManageSubject` pure predicate + `requireOwnerOrAdmin` session guard

**Files:**
- Modify: `lib/roles.ts`
- Create: `lib/roles.test.ts`
- Modify: `lib/appwrite/session.ts`

**Interfaces:**
- Consumes: `Subject` from `lib/supabase/subjects.ts` (Task 1, needs `created_by`), `Profile`/`ProfileRole` from `lib/supabase/profiles.ts`
- Produces: `canManageSubject(profile: { id: string; role: ProfileRole }, subject: { created_by: string }): boolean`, `requireOwnerOrAdmin(subjectId: string): Promise<{ session: Session; profile: Profile }>`

- [ ] **Step 1: Write the failing test for the pure predicate**

Create `lib/roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canManageSubject } from "./roles";

describe("canManageSubject", () => {
  it("allows an admin regardless of ownership", () => {
    expect(
      canManageSubject({ id: "admin-1", role: "admin" }, { created_by: "teacher-1" })
    ).toBe(true);
  });

  it("allows a teacher who owns the subject", () => {
    expect(
      canManageSubject({ id: "teacher-1", role: "teacher" }, { created_by: "teacher-1" })
    ).toBe(true);
  });

  it("denies a teacher who does not own the subject", () => {
    expect(
      canManageSubject({ id: "teacher-2", role: "teacher" }, { created_by: "teacher-1" })
    ).toBe(false);
  });

  it("denies a student", () => {
    expect(
      canManageSubject({ id: "student-1", role: "student" }, { created_by: "student-1" })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/roles.test.ts`
Expected: FAIL — `canManageSubject` is not exported from `./roles`.

- [ ] **Step 3: Implement the predicate**

Add to `lib/roles.ts`:

```ts
import type { ProfileRole } from "@/lib/supabase/profiles";

export function canManageSubject(
  profile: { id: string; role: ProfileRole },
  subject: { created_by: string }
): boolean {
  if (profile.role === "admin") return true;
  return profile.role === "teacher" && subject.created_by === profile.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/roles.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the session guard**

In `lib/appwrite/session.ts`, add below `requireAnyRole`:

```ts
import { canManageSubject } from "@/lib/roles";
import { getSubject } from "@/lib/supabase/subjects";

// Admins pass unconditionally; teachers pass only if they own the subject.
// 404s (not redirects) on mismatch, matching requireRole/requireAnyRole —
// a locked subject shouldn't reveal it exists to a non-owning teacher.
export const requireOwnerOrAdmin = cache(async (subjectId: string) => {
  const { session, profile } = await requireAnyRole(["admin", "teacher"]);
  const subject = await getSubject(subjectId);
  if (!subject || !canManageSubject(profile, subject)) notFound();
  return { session, profile };
});
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/roles.ts lib/roles.test.ts lib/appwrite/session.ts
git commit -m "feat: add canManageSubject predicate and requireOwnerOrAdmin guard"
```

---

### Task 3: Open subject/topic/subtopic actions to teacher ownership

**Files:**
- Modify: `app/actions/subjects.ts`

**Interfaces:**
- Consumes: `requireOwnerOrAdmin(subjectId)` from Task 2, `requireAnyRole` from `lib/appwrite/session.ts` (existing), `getTopic`/`getSubtopic` from `lib/supabase/topics.ts` (existing — `getSubtopic` returns `SubtopicWithTopic` with `.topic.subject.id`)

- [ ] **Step 1: Update imports**

At the top of `app/actions/subjects.ts`, add `requireOwnerOrAdmin` to the existing `@/lib/appwrite/session` import, and add `getSubtopic` to the existing `@/lib/supabase/topics` import:

```ts
import { requireRole, requireAnyRole, requireOwnerOrAdmin } from "@/lib/appwrite/session";
```

```ts
import {
  createTopics,
  createCustomTopic,
  deleteTopic,
  deleteSubtopic,
  getTopic,
  getSubtopic,
  publishTopic,
  publishSubtopic,
  unpublishTopic,
  unpublishSubtopic,
  updateTopic,
  updateSubtopic,
  publishAllTopicsBySubject,
  updateTopicInstructions,
  listTopicsBySubject,
  deleteDraftTopicsBySubject,
  deleteDraftTopicsBySubjectAndBoard,
} from "@/lib/supabase/topics";
```

- [ ] **Step 2: Widen `createSubjectAction` to teachers, stamping ownership (already does via `createdBy: profile.id`)**

Change the guard on `createSubjectAction` (around line 81):

```ts
const { profile } = await requireAnyRole(["admin", "teacher"]);
```

(No other change needed here — `createSubject({ ..., createdBy: profile.id, ... })` already stamps the creator correctly for either role.)

- [ ] **Step 3: Swap subject-scoped actions to `requireOwnerOrAdmin`**

For each of these actions, replace `await requireRole("admin");` (or the profile-destructured form) with `await requireOwnerOrAdmin(subjectId);`, reading `subjectId` from `formData` *before* the check instead of after:

- `deleteSubjectAction`
- `publishSubjectAction` (keep destructuring `{ profile }` — still needed for `pregenerateTopicContent`)
- `unpublishSubjectAction`
- `saveSpecAction`
- `generateTopicsAction` (keep `{ profile }`)
- `generateSingleTopicAction` (keep `{ profile }`)
- `addCustomTopicAction` (keep `{ profile }`)
- `saveSubjectArchetypeAction`
- `saveSubjectInstructionsAction`

Example (`deleteSubjectAction`):

```ts
export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  await requireOwnerOrAdmin(subjectId);

  await deleteSubject(subjectId);
  revalidatePath("/admin/subjects");
  revalidatePath("/teacher/subjects");
  redirect("/admin/subjects");
}
```

(Every `revalidatePath("/admin/subjects")` / `revalidatePath("/admin/subjects/[subjectId]", "page")` call in this file gets a matching `revalidatePath("/teacher/subjects")` / `revalidatePath("/teacher/subjects/[subjectId]", "page")` added alongside it, so both surfaces stay fresh regardless of which one a teacher used.)

- [ ] **Step 4: Swap topic-scoped actions — resolve `subjectId` via `getTopic` first**

These actions take a `topicId`, not a `subjectId` directly. Load the topic first (they mostly already do, for other reasons) and check ownership against `topic.subject.id`:

- `deleteTopicAction`
- `saveTopicInstructionsAction`
- `publishTopicAction` (keep `{ profile }`)
- `unpublishTopicAction`
- `editTopicAction`
- `regenerateTopicLessonAction` (keep `{ profile }`)
- `requestTopicEditAction` (keep `{ profile }`)

Example (`deleteTopicAction`):

```ts
export async function deleteTopicAction(formData: FormData): Promise<void> {
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  await requireOwnerOrAdmin(topic.subject.id);

  await deleteTopic(topicId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}
```

For actions that already call `getTopic` later in the function body for other reasons (`regenerateTopicLessonAction`, `requestTopicEditAction`), move that call earlier so it can also drive the ownership check, rather than fetching the topic twice.

- [ ] **Step 5: Swap subtopic-scoped actions — resolve `subjectId` via `getSubtopic`**

- `deleteSubtopicAction`
- `publishSubtopicAction`
- `unpublishSubtopicAction`
- `editSubtopicAction`

Example (`deleteSubtopicAction`):

```ts
export async function deleteSubtopicAction(formData: FormData): Promise<void> {
  const subtopicId = formData.get("subtopicId");
  if (typeof subtopicId !== "string") throw new Error("Missing subtopicId.");
  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");
  await requireOwnerOrAdmin(subtopic.topic.subject.id);

  await deleteSubtopic(subtopicId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}
```

(`getSubtopic` is already added to the `lib/supabase/topics` import in Step 1.)

- [ ] **Step 6: Leave `addExamBoardAction` and `updateQuestionVerificationAction` as-is**

Both already use `requireAnyRole(["admin", "teacher"])` and aren't subject-ownership-scoped (exam boards are a shared global list; question verification is already open to any teacher). No change needed.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Manual verification (no DB mocking harness in this repo — verify via the dev server)**

Using the running dev server preview and two test accounts (one admin, one teacher):
1. As the teacher, call `createSubjectAction` (via the UI built in Task 5) — confirm the new subject's `created_by` matches the teacher's profile id (check via Supabase MCP `execute_sql`).
2. As that same teacher, attempt to edit/delete a subject created by admin — confirm it 404s.
3. As the teacher, edit/delete/publish the subject they own — confirm it succeeds.
4. As admin, confirm nothing changed — admin can still manage every subject, owned or not.

- [ ] **Step 9: Commit**

```bash
git add app/actions/subjects.ts
git commit -m "feat: scope subject/topic/subtopic actions to owner-or-admin"
```

---

### Task 4: Parameterize the subject grid and detail page with `basePath`

**Files:**
- Modify: `components/admin-subject-grid.tsx`
- Modify: `app/admin/subjects/[subjectId]/page.tsx`
- Modify: `app/actions/subjects.ts` (`deleteSubjectAction` redirect target)

**Interfaces:**
- Produces: `AdminSubjectGrid` accepts an optional `basePath` prop (default `"/admin/subjects"`); the subject detail page component is renamed conceptually to accept a `basePath` used for its back-link, board-tab links, and the delete-redirect target it passes through.

- [ ] **Step 1: Add `basePath` to `AdminSubjectGrid`**

In `components/admin-subject-grid.tsx`, change the props and the one hardcoded link:

```tsx
export function AdminSubjectGrid({
  initialSubjects,
  basePath = "/admin/subjects",
}: {
  initialSubjects: SubjectItem[];
  basePath?: string;
}) {
```

And the link at the bottom of the detail overlay:

```tsx
<Link
  href={`${basePath}/${selectedSubject.id}`}
  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
>
  Full Subject Manager →
</Link>
```

- [ ] **Step 2: Thread `redirectTo` through `deleteSubjectAction`**

In `app/actions/subjects.ts`, update `deleteSubjectAction` (already touched in Task 3) to read an optional redirect target:

```ts
export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  await requireOwnerOrAdmin(subjectId);

  await deleteSubject(subjectId);
  revalidatePath("/admin/subjects");
  revalidatePath("/teacher/subjects");
  const redirectTo = formData.get("redirectTo");
  redirect(typeof redirectTo === "string" && redirectTo ? redirectTo : "/admin/subjects");
}
```

- [ ] **Step 3: Add `basePath` to the subject detail page and parameterize its two internal links + delete form**

In `app/admin/subjects/[subjectId]/page.tsx`:

- Change the function signature to accept `basePath` as a parameter (default `/admin/subjects`), so the same component can be imported and called from a teacher page with a different value:

```ts
export async function SubjectDetailPage({
  params,
  searchParams,
  basePath = "/admin/subjects",
  requireAccess,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ board?: string }>;
  basePath?: string;
  requireAccess: (subjectId: string) => Promise<unknown>;
}) {
  const { subjectId } = await params;
  const { board: boardParam } = await searchParams;
  await requireAccess(subjectId);

  const subject = await getSubject(subjectId);
  if (!subject) notFound();
  // ...unchanged body...
```

- Replace the hardcoded back-link:

```tsx
<Link href={basePath} className="text-xs text-muted hover:text-foreground">
  ← All subjects
</Link>
```

- Replace the board-tab link template:

```tsx
href={`${basePath}/${subjectId}?board=${board.id}`}
```

- Add a hidden `redirectTo` field to the delete form so it lands back on the right list:

```tsx
<form action={deleteSubjectAction}>
  <input type="hidden" name="subjectId" value={subject.id} />
  <input type="hidden" name="redirectTo" value={basePath} />
  <button type="submit" className="text-xs text-error hover:underline">
    Delete
  </button>
</form>
```

- Rename the default export at the bottom of the file to a thin wrapper preserving the existing admin route's behavior exactly:

```ts
export default async function AdminSubjectDetailPage(props: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ board?: string }>;
}) {
  return SubjectDetailPage({
    ...props,
    basePath: "/admin/subjects",
    requireAccess: async () => requireRole("admin"),
  });
}
```

Keep the `requireRole` import (still used by the wrapper above).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Load `/admin/subjects` and `/admin/subjects/<id>` in the browser preview exactly as before — confirm identical behavior (back-link, board tabs, delete all still work and land on `/admin/subjects`). This task is a pure refactor of the admin path; nothing here should visibly change yet.

- [ ] **Step 6: Commit**

```bash
git add components/admin-subject-grid.tsx "app/admin/subjects/[subjectId]/page.tsx" app/actions/subjects.ts
git commit -m "refactor: parameterize subject grid and detail page with basePath"
```

---

### Task 5: Add `/teacher/subjects` routes

**Files:**
- Create: `app/teacher/subjects/page.tsx`
- Create: `app/teacher/subjects/[subjectId]/page.tsx`
- Modify: `app/teacher/layout.tsx`

**Interfaces:**
- Consumes: `listSubjectSummariesByOwner`, `listExamBoards` from `lib/supabase/subjects.ts`; `AdminSubjectGrid` from `components/admin-subject-grid.tsx`; `CreateSubjectForm`/`AddExamBoardForm` from `app/admin/subjects/`; `SubjectDetailPage` + `requireOwnerOrAdmin` from Task 4/2; `requireRole` from `lib/appwrite/session.ts`

- [ ] **Step 1: Add "Subjects" to the teacher nav**

In `app/teacher/layout.tsx`:

```ts
const NAV_ITEMS = [
  { href: "/teacher/subjects", label: "Subjects" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/mark", label: "Mark Paper" },
  { href: "/teacher/settings", label: "AI Settings" },
];
```

- [ ] **Step 2: Create the teacher subjects list page**

Create `app/teacher/subjects/page.tsx`:

```tsx
import { requireRole } from "@/lib/appwrite/session";
import { listSubjectSummariesByOwner, listExamBoards } from "@/lib/supabase/subjects";
import { AdminSubjectGrid } from "@/components/admin-subject-grid";
import { CreateSubjectForm } from "@/app/admin/subjects/create-subject-form";
import { AddExamBoardForm } from "@/app/admin/subjects/add-exam-board-form";

export default async function TeacherSubjectsPage() {
  const { profile } = await requireRole("teacher");

  const [subjects, examBoards] = await Promise.all([
    listSubjectSummariesByOwner(profile.id),
    listExamBoards(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Your subjects
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create your own subject, add exam boards, paste a spec (optional), generate
          topics, then publish. Lessons and a practice question generate
          automatically as soon as each topic exists. These are separate from
          admin&apos;s subjects — you can only manage the ones you create here.
        </p>
      </div>

      <CreateSubjectForm examBoards={examBoards} />

      <AddExamBoardForm />

      {subjects.length === 0 ? (
        <p className="text-sm text-muted">No subjects yet — add the first one above.</p>
      ) : (
        <AdminSubjectGrid initialSubjects={subjects} basePath="/teacher/subjects" />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Create the teacher subject detail page**

Create `app/teacher/subjects/[subjectId]/page.tsx`:

```tsx
import { SubjectDetailPage } from "@/app/admin/subjects/[subjectId]/page";
import { requireOwnerOrAdmin } from "@/lib/appwrite/session";

export default async function TeacherSubjectDetailPage(props: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ board?: string }>;
}) {
  return SubjectDetailPage({
    ...props,
    basePath: "/teacher/subjects",
    requireAccess: requireOwnerOrAdmin,
  });
}
```

(This works because the `teacher` layout already gates the whole `/teacher/*` tree with `requireRole("teacher")`, and `requireOwnerOrAdmin` layers the ownership check on top for the specific subject.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. In particular, confirm `SubjectDetailPage` is importable as a named export from the admin route file (Next.js allows named exports alongside the required `default` export in a page file).

- [ ] **Step 5: Manual verification**

In the browser preview, logged in as a teacher:
1. Visit `/teacher/subjects` — see the "Subjects" nav item, empty state, create-subject form.
2. Create a subject, confirm it appears in the grid.
3. Open its detail page at `/teacher/subjects/<id>` — confirm the back-link goes to `/teacher/subjects`, generate topics, publish, edit, delete all work exactly like the admin page.
4. Try navigating directly to `/teacher/subjects/<admin-owned-subject-id>` — confirm 404.
5. Confirm `/admin/subjects/...` still works unaffected, logged in as admin.

- [ ] **Step 6: Commit**

```bash
git add app/teacher/subjects app/teacher/layout.tsx
git commit -m "feat: add /teacher/subjects routes for teacher-owned subject management"
```

---

## Follow-on work (not in this plan)

The rest of the original design — `assignments` schema changes (subtopic targeting, due dates), the multi-select assign-work UX, the `/teacher/assignments` overview page, and fork visibility/regenerate/reset controls — is a separate, independently shippable subsystem. Write it as its own plan (`docs/superpowers/plans/<date>-assignment-ux-overhaul.md`) once this one lands, per sections 2–5 of `docs/superpowers/specs/2026-08-23-teacher-content-ownership-and-assignment-ux-design.md`.
