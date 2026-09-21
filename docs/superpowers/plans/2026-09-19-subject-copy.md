# Teacher Subject Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher copy an admin-published subject (full tree: exam boards, topics, subtopics, shared lessons/questions/flashcards) into their own independent, editable, draft subject.

**Architecture:** One new data-layer file (`lib/supabase/subject-copy.ts`) doing the multi-table copy in dependency order (subject → exam-board links → topics → subtopics → lessons/questions/flashcards, using old-id→new-id maps to rewire foreign keys), one new Server Action wrapping it with a `teacher` role check, and a UI section added to the existing `/teacher/subjects` page.

**Tech Stack:** Next.js 16 Server Actions, Supabase (service-role client, no RLS-based authorization — enforced in the action layer per this codebase's established pattern).

## Global Constraints

- No ownership check on the *source* subject when copying — only already-published (public) admin content is ever readable this way, so `requireRole("teacher")` alone is sufficient. `requireOwnerOrAdmin` guards mutation/management of a specific subject, not read-and-copy.
- The copy is always created with `status: "draft"`, regardless of the source subject's status — confirmed decision from the design phase, not the default the codebase would otherwise pick.
- Never copy `lessons`/`questions` rows where `class_id IS NOT NULL` — those are class-specific forks belonging to admin's own classes.
- `flashcard_sets` has no `class_id` column — copy all rows for the topic/subtopic, no filtering needed.
- This repo has no Supabase/Appwrite mocking test harness yet (the test-infrastructure plan for this exists but hasn't been executed). Follow the established convention from the rest of this session: verify DB-touching code via the Supabase MCP tools (`execute_sql`) and the running dev server in the browser, not fabricated unit tests with unverified mocks.
- Run `npx tsc --noEmit` after each task; it must stay clean throughout (matches this session's standing bar — the whole project currently type-checks with zero errors).

---

### Task 1: Data layer — `lib/supabase/subject-copy.ts`

**Files:**
- Create: `lib/supabase/subject-copy.ts`

**Interfaces:**
- Consumes: `createServiceClient` from `./server`; `SubjectSummary` type from `./subjects`
- Produces: `listPublishedAdminSubjects(): Promise<SubjectSummary[]>`, `copySubjectForTeacher(subjectId: string, teacherId: string): Promise<string>`

- [ ] **Step 1: Write the file**

```ts
// lib/supabase/subject-copy.ts
import "server-only";
import { createServiceClient } from "./server";
import type { SubjectSummary } from "./subjects";

// Published subjects authored by an admin — the only copy source, per this
// feature's scope (copying other teachers' subjects is explicitly out).
export async function listPublishedAdminSubjects(): Promise<SubjectSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id), profiles!subjects_created_by_fkey(role)"
    )
    .eq("status", "published")
    .order("name");
  if (error) throw error;
  return (data as any[])
    .filter((d) => d.profiles?.role === "admin")
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      created_at: d.created_at,
      created_by: d.created_by,
      exam_boards: d.subject_exam_boards.flatMap((row: any) => row.exam_boards),
      topicCount: (d.topics as any[]).length,
    }));
}

// Copies subjectId's full tree (subject, exam-board links, topics,
// subtopics, shared lessons/questions/flashcards) into a brand-new, fully
// independent subject owned by teacherId. Returns the new subject's id.
export async function copySubjectForTeacher(
  subjectId: string,
  teacherId: string
): Promise<string> {
  const supabase = createServiceClient();

  const { data: source, error: sourceError } = await supabase
    .from("subjects")
    .select(
      "name, custom_instructions, archetype, subject_exam_boards(exam_board_id, spec_text, spec_url, status)"
    )
    .eq("id", subjectId)
    .single();
  if (sourceError) throw sourceError;

  const { data: newSubject, error: subjectError } = await supabase
    .from("subjects")
    .insert({
      name: source.name,
      custom_instructions: source.custom_instructions,
      archetype: source.archetype,
      created_by: teacherId,
      status: "draft",
    })
    .select("id")
    .single();
  if (subjectError) throw subjectError;
  const newSubjectId: string = newSubject.id;

  const boardLinks = (source.subject_exam_boards as any[]) ?? [];
  if (boardLinks.length > 0) {
    const { error } = await supabase.from("subject_exam_boards").insert(
      boardLinks.map((b) => ({
        subject_id: newSubjectId,
        exam_board_id: b.exam_board_id,
        spec_text: b.spec_text,
        spec_url: b.spec_url,
        status: b.status,
      }))
    );
    if (error) throw error;
  }

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, name, summary, position, status, custom_instructions, exam_board_id")
    .eq("subject_id", subjectId);
  if (topicsError) throw topicsError;
  if (!topics || topics.length === 0) return newSubjectId;

  const { data: newTopics, error: newTopicsError } = await supabase
    .from("topics")
    .insert(
      topics.map((t) => ({
        subject_id: newSubjectId,
        name: t.name,
        summary: t.summary,
        position: t.position,
        status: t.status,
        custom_instructions: t.custom_instructions,
        exam_board_id: t.exam_board_id,
      }))
    )
    .select("id");
  if (newTopicsError) throw newTopicsError;

  const topicIdMap = new Map<string, string>(topics.map((t, i) => [t.id, newTopics[i].id]));
  const sourceTopicIds = topics.map((t) => t.id);

  const { data: subtopics, error: subtopicsError } = await supabase
    .from("subtopics")
    .select("id, topic_id, name, position, status")
    .in("topic_id", sourceTopicIds);
  if (subtopicsError) throw subtopicsError;

  let subtopicIdMap = new Map<string, string>();
  if (subtopics && subtopics.length > 0) {
    const { data: newSubtopics, error: newSubtopicsError } = await supabase
      .from("subtopics")
      .insert(
        subtopics.map((s) => ({
          topic_id: topicIdMap.get(s.topic_id),
          name: s.name,
          position: s.position,
          status: s.status,
        }))
      )
      .select("id");
    if (newSubtopicsError) throw newSubtopicsError;
    subtopicIdMap = new Map(subtopics.map((s, i) => [s.id, newSubtopics[i].id]));
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("topic_id, subtopic_id, content")
    .in("topic_id", sourceTopicIds)
    .is("class_id", null);
  if (lessonsError) throw lessonsError;
  if (lessons && lessons.length > 0) {
    const { error } = await supabase.from("lessons").insert(
      lessons.map((l) => ({
        topic_id: topicIdMap.get(l.topic_id),
        subtopic_id: l.subtopic_id ? subtopicIdMap.get(l.subtopic_id) : null,
        content: l.content,
      }))
    );
    if (error) throw error;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      "topic_id, subtopic_id, prompt, markscheme, max_marks, model_answer, format, section_index, bank_position, verified, image_url"
    )
    .in("topic_id", sourceTopicIds)
    .is("class_id", null);
  if (questionsError) throw questionsError;
  if (questions && questions.length > 0) {
    const { error } = await supabase.from("questions").insert(
      questions.map((q) => ({
        topic_id: topicIdMap.get(q.topic_id),
        subtopic_id: q.subtopic_id ? subtopicIdMap.get(q.subtopic_id) : null,
        prompt: q.prompt,
        markscheme: q.markscheme,
        max_marks: q.max_marks,
        model_answer: q.model_answer,
        format: q.format,
        section_index: q.section_index,
        bank_position: q.bank_position,
        verified: q.verified,
        image_url: q.image_url,
      }))
    );
    if (error) throw error;
  }

  const { data: flashcardSets, error: flashcardsError } = await supabase
    .from("flashcard_sets")
    .select("topic_id, subtopic_id, cards")
    .in("topic_id", sourceTopicIds);
  if (flashcardsError) throw flashcardsError;
  if (flashcardSets && flashcardSets.length > 0) {
    const { error } = await supabase.from("flashcard_sets").insert(
      flashcardSets.map((f) => ({
        topic_id: topicIdMap.get(f.topic_id),
        subtopic_id: f.subtopic_id ? subtopicIdMap.get(f.subtopic_id) : null,
        cards: f.cards,
      }))
    );
    if (error) throw error;
  }

  return newSubjectId;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Verify `listPublishedAdminSubjects` against the live database**

Run via the Supabase MCP `execute_sql` tool (project id `cgahkcboiaherxajecys`) to confirm the query shape resolves without a PostgREST embed-ambiguity error — the equivalent raw check:

```sql
select s.id, s.name, p.role
from subjects s
join profiles p on p.id = s.created_by
where s.status = 'published';
```

Expected: runs without error (0 rows is fine — the project currently has no subjects at all per earlier exploration this session; the point is confirming the join path is valid, not that data exists).

- [ ] **Step 4: Verify `copySubjectForTeacher` end-to-end against the live database**

Since there's no seed data, this needs at least one real published admin subject with a topic to copy. If none exists, create a minimal one first via the Supabase MCP `execute_sql` tool (a subject row with `status='published'`, one topic, one subtopic) — then call `copySubjectForTeacher` via a throwaway script or by temporarily invoking it from the dev server (e.g. a scratch Server Action hit once via `curl` or the browser, then removed). Confirm via `execute_sql`:
- The new subject has `status = 'draft'` and `created_by` set to the test teacher's profile id.
- The new topic's `subject_id` points at the new subject, not the source.
- Editing the copy's topic name (a plain `UPDATE`) doesn't change the source topic's name.

Clean up any scratch verification code/rows created for this step before moving on.

---

### Task 2: Action layer — `app/actions/subject-copy.ts`

**Files:**
- Create: `app/actions/subject-copy.ts`

**Interfaces:**
- Consumes: `requireRole` from `@/lib/appwrite/session`; `copySubjectForTeacher` from `@/lib/supabase/subject-copy` (Task 1)
- Produces: `copySubjectAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Write the file**

```ts
// app/actions/subject-copy.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { copySubjectForTeacher } from "@/lib/supabase/subject-copy";

export async function copySubjectAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");

  const newSubjectId = await copySubjectForTeacher(subjectId, profile.id);

  revalidatePath("/teacher/subjects");
  redirect(`/teacher/subjects/${newSubjectId}`);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

### Task 3: UI — extend `/teacher/subjects`

**Files:**
- Modify: `app/teacher/subjects/page.tsx`

**Interfaces:**
- Consumes: `listPublishedAdminSubjects` from `@/lib/supabase/subject-copy` (Task 1); `copySubjectAction` from `@/app/actions/subject-copy` (Task 2); `Button` from `@/components/button` (existing import used elsewhere in this codebase's teacher pages, e.g. `app/teacher/classes/page.tsx:8`)

- [ ] **Step 1: Add the new imports and data fetch**

Current top of the file (`app/teacher/subjects/page.tsx:1-13`):

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
```

Replace with:

```tsx
import { requireRole } from "@/lib/appwrite/session";
import { listSubjectSummariesByOwner, listExamBoards } from "@/lib/supabase/subjects";
import { listPublishedAdminSubjects } from "@/lib/supabase/subject-copy";
import { copySubjectAction } from "@/app/actions/subject-copy";
import { AdminSubjectGrid } from "@/components/admin-subject-grid";
import { Button } from "@/components/button";
import { CreateSubjectForm } from "@/app/admin/subjects/create-subject-form";
import { AddExamBoardForm } from "@/app/admin/subjects/add-exam-board-form";

export default async function TeacherSubjectsPage() {
  const { profile } = await requireRole("teacher");

  const [subjects, examBoards, adminSubjects] = await Promise.all([
    listSubjectSummariesByOwner(profile.id),
    listExamBoards(),
    listPublishedAdminSubjects(),
  ]);
```

- [ ] **Step 2: Add the "Copy from admin" section**

Current tail of the file (`app/teacher/subjects/page.tsx:29-39`):

```tsx
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

Replace with:

```tsx
      <CreateSubjectForm examBoards={examBoards} />

      <AddExamBoardForm />

      {adminSubjects.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Copy from admin
          </h2>
          <p className="mt-1 text-sm text-muted">
            Get your own editable copy of an admin subject, including its topics and lessons.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {adminSubjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted">{s.topicCount} topics</p>
                </div>
                <form action={copySubjectAction}>
                  <input type="hidden" name="subjectId" value={s.id} />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                    Copy to my subjects
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {subjects.length === 0 ? (
        <p className="text-sm text-muted">No subjects yet — add the first one above.</p>
      ) : (
        <AdminSubjectGrid initialSubjects={subjects} basePath="/teacher/subjects" />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification in the browser**

Using the running dev server preview:
1. Log in as a teacher (or use whichever test account this session has access to — same limitation noted in the earlier subject-ownership plan: no seed accounts exist, so this step may need real credentials that weren't available earlier in this session either; if still unavailable, at minimum confirm the page compiles and renders without a runtime error for an unauthenticated/wrong-role visitor, same as the earlier plan's fallback).
2. Visit `/teacher/subjects`. If at least one published admin subject exists (create one via `execute_sql` if not, per Task 1 Step 4), confirm the "Copy from admin" section lists it with a topic count.
3. Click "Copy to my subjects" — confirm it redirects to `/teacher/subjects/<new-id>` and the new subject appears with `status: draft`, all topics/subtopics present, and (if the source had any) lessons/questions/flashcards present too.
4. Confirm the copy is independent: edit something in the copy (e.g. a topic name) via the existing subject-detail UI and confirm the source admin subject is unaffected.

- [ ] **Step 5: Commit** (if this repo has a git remote configured by the time this runs — it didn't earlier in this session; skip if still absent)

```bash
git add lib/supabase/subject-copy.ts app/actions/subject-copy.ts app/teacher/subjects/page.tsx
git commit -m "feat: let teachers copy an admin subject's full content into their own"
```

---

## Self-review notes

- **Spec coverage:** all three spec sections (data layer, action layer, UI) map 1:1 to Tasks 1-3. The spec's "Testing" section is folded into Task 1 Step 4 and Task 3 Step 4 (manual verification) rather than fabricated unit tests, per the Global Constraints note about this repo's current lack of a mocking harness.
- **Type consistency:** `copySubjectForTeacher(subjectId: string, teacherId: string): Promise<string>` is identical across the spec, Task 1's produced interface, and Task 2's usage. `listPublishedAdminSubjects(): Promise<SubjectSummary[]>` likewise matches its usage in Task 3.
- **No placeholders:** every step has real, complete code; no "similar to" references — Task 3 shows the full before/after of the file it modifies rather than describing the diff.
