# Teacher subject copy (sub-project 1 of 3)

## Context

This is the first of three independent features requested together: (1) teacher subject copying (this spec), (2) subtopic-level assignment, (3) an AI paper-marking pipeline. Decomposed per user direction — ship in that order, since (1) and (2) build directly on infrastructure that already exists (`requireOwnerOrAdmin`, teacher-owned subjects from the earlier subject-ownership work) while (3) is a large, independent new system.

## Problem

Teachers can create their own subjects from scratch (`/teacher/subjects`, built earlier this project) and customize per-class lesson/question content via the existing AI-fork mechanism. But there's no way for a teacher to take an admin-published subject's already-built content (topics, subtopics, lessons, questions, flashcards) and get their own independent, editable copy of it. Today the only paths are: use admin's subject as-is (no customization), or build an equivalent subject from scratch via AI generation (loses admin's vetted content entirely).

## Goals

1. A teacher can browse admin-published subjects and copy one into their own subject library.
2. The copy is a full, independent copy — subject/topics/subtopics/lessons/questions/flashcards — not a live reference to admin's content. Editing the copy never touches admin's original, and vice versa.
3. The copy starts as a draft, so the teacher can review before it's visible to their own students.

## Non-goals

- Copying from other teachers' subjects (scope is explicitly admin-authored content only, per the request).
- Copying class-forked lesson/question content (`class_id` non-null rows) — those are specific to admin's own classes and irrelevant to a different teacher's copy.
- A background job / async copy — this runs synchronously inside one Server Action request.
- Any two-way sync or "pull updates from admin's original" mechanism — once copied, the two are fully independent forever.

## Design

### Data layer — new file `lib/supabase/subject-copy.ts`

Kept separate from `lib/supabase/subjects.ts` because this is a distinct, multi-table operation (touches 7 tables) rather than a CRUD wrapper around one — matches the codebase's existing pattern of splitting by responsibility (e.g. `class-content.ts` is separate from `lib/supabase/lessons.ts`/`questions.ts` for the same reason).

```ts
import "server-only";
import { createServiceClient } from "./server";

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
// subtopics, shared lessons/questions/flashcards) into a brand-new,
// fully independent subject owned by teacherId. Returns the new subject's id.
export async function copySubjectForTeacher(
  subjectId: string,
  teacherId: string
): Promise<string> {
  const supabase = createServiceClient();

  // 1. Source subject + its exam board links
  const { data: source, error: sourceError } = await supabase
    .from("subjects")
    .select("name, custom_instructions, archetype, subject_exam_boards(exam_board_id, spec_text, spec_url, status)")
    .eq("id", subjectId)
    .single();
  if (sourceError) throw sourceError;

  // 2. New subject row — always draft regardless of source status
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
  const newSubjectId = newSubject.id;

  // 3. Exam board links
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

  // 4. Topics
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

  const topicIdMap = new Map(topics.map((t, i) => [t.id, newTopics[i].id]));

  // 5. Subtopics
  const { data: subtopics, error: subtopicsError } = await supabase
    .from("subtopics")
    .select("id, topic_id, name, position, status")
    .in("topic_id", topics.map((t) => t.id));
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

  // 6. Shared (class_id IS NULL) lessons — per topic and per subtopic
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("topic_id, subtopic_id, content")
    .in("topic_id", topics.map((t) => t.id))
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

  // 7. Shared (class_id IS NULL) questions — per topic and per subtopic
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      "topic_id, subtopic_id, prompt, markscheme, max_marks, model_answer, format, section_index, bank_position, verified, image_url"
    )
    .in("topic_id", topics.map((t) => t.id))
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

  // 8. Flashcard sets — no class_id concept on this table, copy all
  const { data: flashcardSets, error: flashcardsError } = await supabase
    .from("flashcard_sets")
    .select("topic_id, subtopic_id, cards")
    .in("topic_id", topics.map((t) => t.id));
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

This reuses the existing `SubjectSummary` type from `lib/supabase/subjects.ts`. The FK name `subjects_created_by_fkey` used in the `profiles!subjects_created_by_fkey(role)` embed was confirmed against the live schema (`select conname from pg_constraint where conrelid = 'public.subjects'::regclass and contype = 'f'`) during this design pass — PostgREST's embed syntax requires the exact constraint name, so this isn't a guess.

### Action layer — new file `app/actions/subject-copy.ts`

```ts
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

No ownership check on the source subject — copying only ever reads already-published (public) admin content, so there's nothing to authorize beyond "is a teacher." `requireOwnerOrAdmin` is for mutating/viewing a specific subject's management UI, not relevant here.

### UI — extends `app/teacher/subjects/page.tsx`

Adds a "Copy from admin" section above or below the existing "Your subjects" grid:

```tsx
import { listPublishedAdminSubjects } from "@/lib/supabase/subject-copy";
import { copySubjectAction } from "@/app/actions/subject-copy";
// ...existing imports

// inside the page component, alongside the existing listSubjectSummariesByOwner call:
const adminSubjects = await listPublishedAdminSubjects();

// ...rendered as a new section:
<div>
  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
    Copy from admin
  </h2>
  <p className="mt-1 text-sm text-muted">
    Get your own editable copy of an admin subject, including its topics and lessons.
  </p>
  <div className="mt-3 grid gap-3 sm:grid-cols-2">
    {adminSubjects.map((s) => (
      <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
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
```

### Testing

- `copySubjectForTeacher` on a subject with N topics, M subtopics, and existing lessons/questions/flashcards produces a fully independent tree: editing the copy's topic name doesn't change the source's; the copy's `lessons`/`questions` rows reference the copy's own `topic_id`/`subtopic_id`, never the source's.
- Class-forked (`class_id` non-null) lessons/questions on the source are never copied.
- The new subject is always `status: "draft"` regardless of the source's status.
- A subject with zero topics copies cleanly (early return after step 4, no subsequent empty-array `.in()` calls).
- `listPublishedAdminSubjects` excludes a published subject created by a teacher (not an admin) and excludes a draft admin subject.
- `copySubjectAction` requires `teacher` role; a student/other role gets `notFound()` via `requireRole`.

## Out of scope for this spec

Subtopic-level assignment and the AI paper-marking pipeline — separate specs, per the agreed build order.
