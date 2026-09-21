# Paper marking — bulk answer upload, AI splitting, marking (sub-project 3 of 4)

## Context

Third of four paper-marking pipeline stages. (1) ingestion and (2) roster building shipped earlier this session. This spec covers: teacher uploads a bulk batch of scanned student answer scripts, AI figures out which pages belong to which student via reference codes, marks each student's answers against the paper's questions, and stores per-question feedback. Built autonomously per explicit user instruction ("just do the entire thing and come back to me") — design calls below are mine, made in the user's absence, documented for review afterward rather than gated on it beforehand.

## Scope decision: file-level grouping, not page-level PDF splitting

The original request describes uploading "multiple or single pdf, zip, images" and having AI "separate it into different students' work using the reference number." The hardest version of this problem is a single merged PDF containing many students' scripts back-to-back, requiring page-range splitting inside one file — that needs a PDF rasterization/splitting library this codebase doesn't have, and building one is its own sub-project.

**Decision:** group at the **file** level, not the page level within a file. Concretely:
- Each uploaded file (after any `.zip` is expanded into its contents) is treated as one scanned page or one complete script.
- A quick, cheap AI vision call reads any reference code visible on that file.
- A file with a matched code **starts a new student's group**.
- A file with no legible code **continues the previous group** (the common real-world case: a student writes their code once on page 1 of a multi-photo submission, not on every page).
- This covers both realistic upload patterns: one PDF per student (code on file, no grouping needed), and one image per page per student (code on the first image, subsequent images grouped in automatically) — without needing to split a merged document.

If this turns out to be insufficient in practice (teachers really do scan everyone into one giant PDF), that's a well-scoped follow-up: add PDF page-splitting as its own change, without touching anything else here.

## Data model

```sql
CREATE TABLE public.paper_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  roster_entry_id uuid REFERENCES public.paper_roster_entries(id),
  detected_reference_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'marked', 'unmatched', 'error')),
  error_message text,
  image_file_ids text[] NOT NULL DEFAULT '{}',
  total_marks_awarded integer,
  total_possible_marks integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.paper_submission_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.paper_submissions(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  marks_awarded integer NOT NULL,
  max_marks integer NOT NULL,
  feedback jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paper_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_submission_answers ENABLE ROW LEVEL SECURITY;
```

`roster_entry_id` is nullable — an `unmatched` submission (code unreadable, or read but doesn't match any roster entry for this paper) has no roster link until a teacher manually reassigns it. `detected_reference_code` keeps whatever the AI actually read (even a near-miss/garbled code) so the teacher has something to go on when reconciling. `image_file_ids` are Appwrite storage file ids (same pattern as `practice-uploads.ts`'s `imagePaths`), kept so a teacher can pull up the original scan for a disputed mark.

## New file: `lib/ai/paper-marking.ts`

Two functions, both following the established provider-selection/transport pattern from `lib/ai/marking.ts` and `lib/ai/paper-extraction.ts`:

- `detectReferenceCode(images: {bytes, contentType}[]): Promise<string | null>` — one cheap vision call per file, asking only "what reference code (if any) is visible on this page? Return null if none is legible." Kept as its own function (not folded into marking) because it runs once per uploaded file, before grouping even happens — a different call shape and cardinality than marking.
- `markSubmissionAgainstPaper(input: {questions: {questionNumber, prompt, maxMarks, markscheme}[], images: {bytes, contentType}[]}): Promise<Array<{questionNumber, marksAwarded, feedback: PointFeedback[]}>>` — one combined vision call per student, given every question on the paper and every image in that student's group, asking the model to mark whichever questions it can identify answers for. One call per student rather than one per student per question — matches `markAnswersBatch`'s existing "batch multiple questions into one call" precedent in this codebase.

## New file: `lib/supabase/paper-submissions.ts`

CRUD layer: `createSubmission`, `saveSubmissionAnswers`, `updateSubmissionStatus`, `getSubmissionsForPaper` (joined with roster display name), `getSubmissionDetail`, `reassignSubmissionRoster`.

## New file: `app/actions/paper-marking.ts`

`markSubmissionsAction(formData)`:
1. `requireRole("teacher")`, ownership + `status === 'ready'` check, roster non-empty check.
2. Read uploaded files; expand any `.zip` via `jszip` into its contained files (flattened into the same ordered list, zip entries in their archive order).
3. For each file in order: call `detectReferenceCode`. A matched code (exists in this paper's roster) closes the current group and starts a new one. An unmatched-but-present code also starts a new group, tagged `unmatched` with that code recorded. No code continues the current group (or, if there is no current group yet, starts a new `unmatched` group with `detected_reference_code: null`).
4. For each group: upload its files to Appwrite storage, create a `paper_submissions` row.
5. For each **matched** group only: call `markSubmissionAgainstPaper`, save `paper_submission_answers`, compute totals, set `status: 'marked'`. Wrapped per-group in try/catch — one student's marking failure (`status: 'error'`, `error_message` set) never blocks the rest of the batch, matching `generateTopicsAction`'s `Promise.allSettled`-style resilience precedent.
6. Redirect to `/teacher/papers/[paperId]/results`.

`reassignSubmissionAction(formData)`: teacher manually assigns an `unmatched` submission to a specific roster entry, then runs the same marking call for it and updates its status — the reconciliation path for codes the AI couldn't read or that don't match anyone.

## UI

- `/teacher/papers/[paperId]/mark`: upload form (multi-file, accepts `.pdf,.zip,image/*`), only reachable when the paper is `ready` and has a non-empty roster.
- `/teacher/papers/[paperId]/results`: every submission for the paper — matched ones show student name + total score + a link to detail; unmatched ones show the detected code (or "no code detected") with an inline reassign-to-roster-entry form.
- `/teacher/papers/[paperId]/results/[submissionId]`: per-question marks and feedback for one student.
- Paper detail page gets a "Mark submissions" / "View results" link once appropriate.

## Testing

Given no mocking harness exists in this repo (established convention all session): verify `detectReferenceCode` and `markSubmissionAgainstPaper` with real test images against the real configured provider, verify the grouping logic with a manufactured sequence of file→code detections (a pure function, unit-testable without AI), verify the full DB layer against the live Supabase project with throwaway rows cleaned up afterward, and verify all new routes compile/redirect correctly in the browser.
