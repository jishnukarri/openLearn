# Teacher content ownership + assignment UX

## Problem

Today, subject/topic/subtopic creation is admin-only (`requireRole("admin")` throughout `app/actions/subjects.ts`). Teachers can only assign admin-published topics to their classes, one topic at a time, via a single `<select>` per class on `/teacher/classes`, with no due dates, no subtopic-level targeting, no multi-class assignment, and no way to edit or remove an assignment once created.

Separately, the app already has a working per-class content customization mechanism that isn't surfaced anywhere: `lessons` and `questions` rows carry a nullable `class_id`. When a teacher attaches a note to an assignment (`assignTopicAction`'s `notes` field), `lib/class-content.ts`'s `resolveLessonContent`/`resolveQuestionContent` lazily generate and cache a class-specific ("forked") lesson/question via AI, using the note as extra instruction. Students in that class then always get the fork instead of the shared topic-wide content. This is invisible to the teacher after the fact — there's no indication a fork exists, no way to regenerate it, and no way to revert to the shared version.

## Goals

1. Let teachers create and fully manage their **own** subjects/topics/subtopics, using the same admin tooling, without touching admin-owned content.
2. Make the existing AI-fork customization mechanism visible and manageable instead of implicit.
3. Replace the one-topic-per-class assignment form with a proper multi-select, multi-class, due-date-aware flow, plus a real overview/edit/delete surface.

## Non-goals

- No manual/WYSIWYG editing of lesson content. The AI-fork-via-note mechanism stays as the only customization path (confirmed with user — keep it, just surface it better).
- No change to admin's own subject management UI/permissions.
- No cross-teacher sharing of teacher-owned subjects (out of scope; can be a future extension).

## 1. Permission model

Ownership key: `subjects.created_by` (already exists). Topics/subtopics inherit ownership transitively through their parent subject — no new `created_by` column needed on `topics`/`subtopics`.

New helper in `lib/appwrite/session.ts`:

```ts
// Admins pass unconditionally. Teachers pass only if they own the subject
// (subjects.created_by === profile.id). 404s on mismatch, matching the
// existing requireRole pattern — a locked subject shouldn't reveal it exists.
export const requireOwnerOrAdmin = cache(async (subjectId: string) => {
  const { session, profile } = await requireAnyRole(["admin", "teacher"]);
  if (profile.role === "admin") return { session, profile };
  const subject = await getSubject(subjectId);
  if (!subject || subject.created_by !== profile.id) notFound();
  return { session, profile };
});
```

Changes to `app/actions/subjects.ts`:
- `createSubjectAction`: gate changes from `requireRole("admin")` to `requireAnyRole(["admin", "teacher"])`. Set `created_by = profile.id` on insert (already a column, just needs to be populated for teacher-created rows the same way it presumably is for admin).
- Every other action that takes a `subjectId` (update, delete, publish, add exam board, create topic, create subtopic, etc.): gate changes from `requireRole("admin")` to `requireOwnerOrAdmin(subjectId)`.
- Topic/subtopic-scoped actions resolve the parent `subjectId` first (they already load the topic/subtopic to act on it), then apply the same check.

No RLS changes needed — authorization stays enforced in Server Actions like the rest of the app (Supabase access is service-role-only, per the existing architecture).

UI: reuse `/admin/subjects` components under a new `/teacher/subjects` route, scoped by the ownership check server-side. A teacher only ever sees/edits subjects where `created_by === profile.id`; admin subjects don't appear in this list at all (they're managed the normal way, from `/admin/subjects`, and touched by teachers only through the fork mechanism in section 4).

## 2. Data model changes

```sql
ALTER TABLE public.assignments
  ADD COLUMN subtopic_id uuid REFERENCES public.subtopics(id),
  ADD COLUMN due_date timestamptz;

ALTER TABLE public.assignments
  ALTER COLUMN topic_id DROP NOT NULL;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_topic_or_subtopic_chk
  CHECK (topic_id IS NOT NULL OR subtopic_id IS NOT NULL);
```

- `topic_id` becomes nullable to support subtopic-only assignments; existing rows are unaffected (all currently have `topic_id` set).
- `subtopic_id` nullable, references `subtopics.id`.
- `due_date` nullable timestamptz — no due date is a valid state.
- Check constraint ensures every assignment targets at least one of topic/subtopic (in practice exactly one, enforced at the application layer).

`lib/supabase/assignments.ts`'s `createAssignment`/`listAssignmentsForClass`/etc. get updated signatures to carry `subtopicId`/`dueDate` alongside the existing `topicId`/`notes`.

## 3. Assign-work UX

Replaces the per-class inline form on `/teacher/classes` with a single **"Set work"** panel (rendered once per teacher, not once per class):

- **Content picker**: subjects → topics → subtopics as a collapsible checkbox tree, multi-select at topic *or* subtopic granularity (selecting a subtopic doesn't imply the whole topic). A text filter narrows the tree by name for teachers with many subjects/topics.
- **Class picker**: checkboxes for the teacher's classes (multi-select), next to the content tree.
- **Due date**: optional single date field applied to the whole batch being created.
- **Notes**: unchanged free-text field, still the trigger for the AI class-fork (section 4).
- **Submit**: creates one `assignments` row per (selected class × selected content item) pair. Implemented as a loop over `createAssignment`, mirroring how `copyAssignmentsAction` already batches inserts — no new batching primitive needed.

`assignTopicAction` is replaced by `assignWorkAction(formData)` accepting arrays of `classIds[]` and `items[]` (each item tagged as `topic:<id>` or `subtopic:<id>`), plus optional `dueDate` and `notes`.

## 4. Assignments overview page

New route `/teacher/assignments`:

- Lists every assignment across all of the teacher's classes, sortable by due date, filterable/groupable by class.
- Each row: content name (with subject/topic context), class, due date, notes, fork status (section 5), and now **Edit** (change due date/notes) and **Remove** actions — today's form is append-only with no correction path.
- `/teacher/classes` keeps a compact read-only "what's assigned here" list per class (as today), linking out to `/teacher/assignments` for anything beyond a glance or for editing.

New actions in `app/actions/assign.ts`: `updateAssignmentAction`, `deleteAssignmentAction`, both re-using the existing `assertOwnsClass` ownership check.

## 5. Fork visibility

No new content-editing UI. This section only makes the existing `lib/class-content.ts` fork mechanism visible and reversible:

- In the content picker (section 3) and the overview (section 4), any topic/subtopic that has a class-specific fork (`lessons`/`questions` row with matching `class_id`) for a given class shows a **"Customized"** badge.
- On the overview, a forked assignment gets two actions:
  - **Regenerate**: re-runs `resolveLessonContent`/`resolveQuestionContent`'s fork branch with the assignment's current notes (useful after editing the notes).
  - **Reset to shared**: deletes the class-scoped `lessons`/`questions` rows (`class_id` match), so the class falls back to the shared topic-wide content on next access.
- New helper `lib/supabase/assignments.ts`: `hasFork(topicOrSubtopicId, classId)` — a simple existence check, called when rendering the picker/overview.

## Testing

- Ownership checks: teacher A cannot edit/delete/publish a subject created by teacher B or by admin (404, not error leak). Teacher can fully CRUD their own subject.
- Assignment batch creation: selecting 2 classes × 3 content items creates exactly 6 `assignments` rows with correct `topic_id`/`subtopic_id` split.
- `assignments_topic_or_subtopic_chk` rejects a row with both null.
- Fork reset actually clears `class_id`-scoped rows and a subsequent lesson fetch regenerates or falls back to shared content correctly (existing `resolveLessonContent` logic already handles the "no existing fork" path — reset just needs to delete, not touch that logic).
