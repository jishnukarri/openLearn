# Platform upgrades — flashcards, mastery, spec RAG, reports, DIN

Seven related features requested together. Each phase is self-contained and
executable in a fresh chat context. Do them in order — later phases assume
earlier ones landed (mastery scoring needs unified flashcards; spec RAG
needs PDF storage).

## Context gathered (Phase 0)

- **Flashcards today**: `lib/ai/flashcards.ts` generates a topic-wide 10-14
  card AI deck, stored via `lib/supabase/flashcards.ts` (`flashcard_sets`
  table, one row per topic/subtopic, `cards: Flashcard[]`). `/flashcards/[topicId]`
  calls `resolveFlashcards` (in `app/actions/flashcards.ts` — not yet read,
  check it in Phase 1) which lazily generates+caches on first visit.
  In-lesson flashcards (`lesson-player.tsx` flashcard phase) build cards
  directly from `LessonSection.heading`/`explanation` — zero AI calls,
  never touches `flashcard_sets`. These are two different decks today.
- **Progress/completion**: `lib/supabase/progress.ts` — `markTopicComplete`/
  `markSubtopicComplete` upsert into `topic_completions`/`subtopic_completions`.
  Currently only called from `completeLessonAction` in `app/actions/lessons.ts`.
  `awardXp` is called from both lesson completion and practice answer
  submission (`app/actions/practice.ts`).
- **Question attempts**: `lib/supabase/questions.ts` has `recordAnswer`,
  and a separate session-based bank flow (`createQuestionSession`,
  `recordQuestionSessionAttempt`, `completeSession` — used by
  `submitBankAnswerAction`). Need to check `recordAnswer`'s row shape in
  Phase 3 to know what history is queryable per student/topic.
- **RAG (existing)**: `lib/rag.ts` + `lib/supabase/topic-documents.ts` —
  teacher-uploaded reference docs, chunked (`lib/text-chunk.ts`), embedded
  (`lib/ai/embeddings.ts`), stored in `topic_documents`/`topic_document_chunks`,
  retrieved via pgvector similarity search (`searchTopicChunks`). This is
  the pattern to clone for spec RAG, not extend — subject-level spec text
  is a different shape (per exam board, not per topic) and today it's
  **not chunked/embedded at all**, just concatenated raw text
  (`lib/supabase/subjects.ts` `spec_text` column, ~line 156-184).
- **Spec storage today**: `exam_boards.spec_text` — plain text, pasted or
  extracted-then-discarded from an uploaded file
  (`app/admin/subjects/[subjectId]/page.tsx` spec tab, `specFile` input).
  The original PDF is never kept.
- **Reports**: `content_reports` table (`lib/supabase/reports.ts`) stores
  `topic_id | subtopic_id | question_id` (nullable) + `context_label` +
  `message`. Admin page (`app/admin/reports/page.tsx`) lists them with a
  "Mark resolved" button but no link to the actual content.
- **Lesson player steps**: `buildLessonPlan()` in
  `app/learn/[topicId]/lesson-player.tsx` — the `interactive`/`hook` phases
  run before any teach/check pair. There's no existing "recap prior
  topics" step; the user wants a new opening phase (renamed/reframed as
  "DIN — Do It Now") that quizzes prior/related topic content, distinct
  from the existing end-of-lesson `recap` phase (which recaps *this*
  lesson's sections). Naming collision to watch: don't rename the
  existing `recap` phase — DIN is a *new* opening phase.
- **Lesson regeneration**: `requestExtraHelpAction` (simpler-style full
  regen) and `tweakLessonAction` (instruction-based revision) already
  exist in `app/actions/lessons.ts`, both admin/teacher-only except
  `requestExtraHelpAction` which any role can call. What's missing per the
  request is a plain "regenerate from scratch" trigger separate from
  "simpler" framing, likely on the admin topic page next to the lesson
  editor — confirm current admin UI in Phase 6.

---

## Phase 1 — Unify in-lesson and standalone flashcards

**Goal**: one AI-generated flashcard deck per topic/subtopic, pregenerated
(not lazy), used identically by the in-lesson flashcard slide and the
`/flashcards/[topicId]` page.

1. Read `app/actions/flashcards.ts` and `lib/class-content.ts` /
   `lib/subtopic-content.ts` `resolveFlashcardsForSubtopic` to see current
   generation trigger points (lazy-on-visit vs. pregenerated at publish
   time — compare to how lessons/questions are pregenerated, since the
   project spec memory says "Lessons and a practice question generate
   automatically as soon as each topic exists" — flashcards should follow
   the same trigger).
2. Wire flashcard generation into whatever function currently
   pregenerates lessons+questions at topic-creation/publish time (grep for
   where `generateLesson`/`generateQuestion` get called together — likely
   in the topic creation action in `app/admin/subjects/[subjectId]/`
   actions or a background job).
3. Change `lesson-player.tsx`'s flashcard phase (`buildLessonPlan`,
   flashcard slide render around line 535) to pull from the same
   `flashcard_sets` deck (via `getFlashcardsByTopic`/`getFlashcardsBySubtopic`)
   instead of deriving cards from section text. Pass the resolved
   `FlashcardSet` into `LessonPlayer` as a prop from the server page, same
   pattern as `sections`/`hook`.
4. Card count mismatch: lesson plan currently groups sections in pairs
   for flashcard slides (`cardIndices: [i-1, i]`, 2 cards per flashcard
   phase). With a pregenerated 10-14 card deck, decide: show the whole
   deck across the flashcard slide(s) in sequence, or keep the paired-grouping
   UX but index into the shared deck instead of `sections`. Prefer the
   latter — smallest change, but needs the shared deck to have enough
   cards to index by section pairing, or a heading-based lookup
   (match `card.front` to nearest `section.heading` via the same AI
   generation that already receives section content — no fuzzy matching
   needed if you pass section headings into the flashcard prompt so the
   model produces one card per section deterministically. Check
   feasibility before committing to this approach vs. "just show all
   cards once, not interleaved per-section".)

**Verification**: generate a topic from scratch, confirm one
`flashcard_sets` row exists before the lesson is ever opened, confirm
`/flashcards/[topicId]` and the in-lesson flashcard slide render the same
cards (compare `front`/`back` text).

---

## Phase 2 — Cross-topic flashcard mastery score + revision hub

**Goal**: per-card (or per-topic) mastery score derived from lesson
flashcard ratings (Hard/Good/Easy, already captured in
`lesson-player.tsx`'s `flashcardRatings` state) and practice question
performance, feeding a platform-wide "revise flashcards from every topic
you've studied" page.

1. New table: `flashcard_reviews` (student_id, flashcard_set_id or
   topic_id, card_index or card front hash, rating enum, reviewed_at) —
   design after checking whether `flashcard_sets` needs a stable per-card
   id (currently cards are a JSON array with no id — add one, e.g.
   `{ id: string, front, back }`, migrating `Flashcard` type in
   `lib/ai/flashcards.ts`).
2. New server action to persist a rating on each `rateCard()` call in
   `lesson-player.tsx` (currently only local React state — add a
   fire-and-forget action call, mirroring how `adaptNextSectionAction` is
   fired in the background without blocking navigation).
3. Mastery score formula: combine flashcard ratings (Easy=high,
   Hard=low, weighted by recency) with practice question accuracy for the
   same topic (from `recordAnswer`/`recordQuestionSessionAttempt` history
   — read `lib/supabase/questions.ts` fully to confirm what's queryable
   per student+topic). Keep the formula in one function,
   e.g. `lib/mastery.ts`, so Phase 3's "skip lesson if mastery is high"
   can reuse it.
4. New page `/revise` (or `/flashcards`) — lists every topic the student
   has any flashcard/question history for, pulls the due/weak cards
   (spaced-repetition-lite: Hard cards resurface sooner) across all of
   them into one mixed deck. Reuse `FlashcardDeck` component, feed it a
   cross-topic card list instead of one topic's `cards`.

**Verification**: rate a few in-lesson flashcards Hard/Good/Easy, confirm
rows land in `flashcard_reviews`, confirm `/revise` surfaces those cards
with Hard-rated ones prioritized.

---

## Phase 3 — Skip-lesson mastery path ("exceptional practice score" auto-completes topic)

**Goal**: a student who scores highly across multiple practice attempts on
a topic's exam questions gets that topic marked complete without ever
opening the lesson.

1. Define "exceptional": needs a concrete threshold — e.g. last N
   attempts (N≥3) each scoring ≥90% of max_marks, or an average across
   all attempts on that topic. Decide against `recordAnswer` history —
   confirm it's queryable by `student_id + topic_id` (join through
   `questions.topic_id`); read `lib/supabase/questions.ts` for the
   `recordAnswer` insert shape and any existing per-student query
   functions before adding a new one.
2. New function `checkMasteryCompletion(studentId, topicId)` in
   `lib/supabase/progress.ts` (or `lib/mastery.ts` from Phase 2) —
   queries recent answer history, applies the threshold, and if met calls
   the existing `markTopicComplete`.
3. Call it from `submitAnswerAction`/`submitBankAnswerAction` in
   `app/actions/practice.ts` right after `recordAnswer`, same place
   `awardXp` is already called — so completion happens the moment the
   qualifying attempt is submitted, not on some separate poll.
4. Surface this to the student: a small toast/banner on the practice page
   ("Nice work — you've mastered this topic, no lesson needed") — check
   `app/practice/[topicId]/` for where `submitAnswerAction`'s result is
   rendered and add a `masteryAchieved` flag to `PracticeState`.

**Verification**: manually submit 3+ high-scoring answers for one topic
via `/practice/[topicId]`, confirm `topic_completions` gets a row without
ever visiting `/learn/[topicId]`.

---

## Phase 4 — Store exam spec PDFs + dedicated spec RAG system

**Goal**: keep the actual spec PDF (not just extracted text), chunk+embed
it separately from the teacher-reference-doc RAG (`topic_documents`), and
use it in both lesson generation and the lesson tutor.

1. New table `spec_documents` (exam_board_id, filename, storage_path,
   uploaded_at) + `spec_document_chunks` (spec_document_id, content,
   embedding vector) — clone the shape of `topic_documents`/
   `topic_document_chunks` from `lib/supabase/topic-documents.ts`, adjust
   the parent key to `exam_board_id` instead of `topic_id`.
2. New `lib/spec-rag.ts` (parallel to `lib/rag.ts`): `indexSpecDocument`
   (store PDF via `uploadFile`, extract via existing
   `extractTextFromFile`, chunk via existing `chunkText`, embed via
   existing `generateEmbedding` — all three helpers already exist and are
   provider-agnostic, just call them against the new tables) and
   `getSpecContext(examBoardId, topicName)` (same similarity-search
   pattern as `getReferenceContext`, but scoped to that exam board's spec
   chunks, not a topic's uploaded docs).
3. Update the admin spec tab (`app/admin/subjects/[subjectId]/page.tsx`,
   `spec` TabsContent, ~line 115-140) — on file upload, keep the file
   (call `indexSpecDocument`) instead of only extracting text into
   `spec_text`. Decide whether to keep `spec_text` (pasted text, no file)
   as a fallback path alongside the new PDF+RAG path, or migrate it
   entirely — recommend keeping both: pasted text still works for admins
   without a PDF, uploaded PDFs get the richer RAG treatment.
4. Wire `getSpecContext` into lesson generation
   (`generateLesson` call sites in `lib/subtopic-content.ts` and
   wherever the topic-level equivalent lives — grep `generateLesson(` call
   sites) by folding it into the `instructions` string alongside
   `withReferenceContext`'s output — same `.slice()`-bounded concatenation
   pattern already used for `custom_instructions` + `getReferenceContext`.
5. Wire `getSpecContext` into the lesson tutor
   (`lib/ai/lesson-tutor.ts` `askLessonTutor` — read this file first,
   not yet read this session) by adding it to the `context` string built
   in `askLessonTutorAction`/`markOpenAnswerAction` in
   `app/actions/lessons.ts`.

**Verification**: upload a spec PDF, confirm `spec_documents`/
`spec_document_chunks` rows exist with non-null embeddings, generate a
lesson for a topic under that exam board and confirm spec-specific
terminology appears (spot-check against the PDF), ask the lesson tutor a
question and confirm the response doesn't contradict the spec.

---

## Phase 5 — Report → deep link to the exact content

**Goal**: clicking a report in `/admin/reports` takes the admin straight
to the page where the flagged content lives, instead of just showing a
text label.

1. `listOpenReports` in `lib/supabase/reports.ts` currently selects
   `context_label, message, status, created_at, profiles(full_name)` —
   add `topic_id, subtopic_id, question_id` to the select (they're already
   columns on `content_reports`, just not returned) and to the
   `ContentReport` type.
2. In `app/admin/reports/page.tsx`, wrap each report card (or just the
   context-label heading) in a `<Link>` computed from whichever id is
   present:
   - `question_id` set → need to resolve which topic/subtopic the
     question belongs to (join through `questions.topic_id`) to build
     `/practice/[topicId]` — or better, a `/admin` question-editing view if
     one exists (check `app/admin` for a question editor route first).
   - `subtopic_id` set, no `question_id` → `/learn/subtopic/[subtopicId]`.
   - `topic_id` set, no `subtopic_id`/`question_id` → `/learn/[topicId]`.
   - Fall back to no link (render plain text) if none resolve, so old
     reports without ids don't break.
3. Since the admin visiting these routes gets the preview banner
   automatically (per today's `page.tsx` role-branching), no new "admin
   view" mode is needed — the existing preview path already surfaces the
   `ReportButton`/edit tools admins need once they land there.

**Verification**: file a report from a lesson and from a practice
question, confirm both show up clickable in `/admin/reports` and land on
the right page.

---

## Phase 6 — Explicit "regenerate lesson" trigger for admins

**Goal**: a plain regenerate action distinct from "simpler" (`requestExtraHelpAction`)
and "tweak" (`tweakLessonAction`), for when the underlying topic/spec
content changed and the admin just wants a fresh generation with current
context (picks up new spec RAG from Phase 4, updated custom instructions,
etc).

1. Check current admin lesson tools — `app/learn/[topicId]/lesson-forms.tsx`
   (`SimplifyForm`, `TweakForm`) and `SubtopicLessonEditor` — for where to
   add a third button.
2. Add `regenerateLessonAction`/`regenerateSubtopicLessonAction` in
   `app/actions/lessons.ts` — essentially `requestExtraHelpAction`'s body
   but with `simplify: false` (or whatever the `generateLesson` boolean
   param at position 3 controls — confirm its meaning, currently passed
   as `true` in `requestExtraHelpAction`) and without the "simpler style"
   framing.
3. Add a `RegenerateForm` client component next to `SimplifyForm`/
   `TweakForm` in `lesson-forms.tsx`, gated admin/teacher only (matches
   existing `tweakLessonAction`/`saveSubtopicLessonAction` role guards).
4. Confirm this doesn't collide with Phase 1's flashcard pregeneration —
   regenerating a lesson shouldn't silently invalidate/orphan the topic's
   flashcard deck unless intended; decide whether "regenerate lesson"
   should also offer "regenerate flashcards" as a checkbox, or leave
   flashcards untouched (recommend: leave untouched by default, flashcards
   have their own regenerate path already via `/flashcards` — verify a
   regenerate exists there too, add one if not).

**Verification**: edit a topic's custom instructions or spec, hit
regenerate, confirm the new lesson content reflects the change.

---

## Phase 7 — Rename pre-lesson recap step to "DIN" (Do It Now)

**Goal**: add/rename an opening lesson phase that recaps prior/related
topic content before the new lesson starts, branded "DIN — Do It Now" (a
real classroom-teaching convention: a short retrieval-practice starter).

**Important**: this is *not* the same as the existing end-of-lesson
`recap` phase in `buildLessonPlan()` (`app/learn/[topicId]/lesson-player.tsx`
line ~68) — that one recaps sections just taught in *this* lesson and
must keep its current behavior/position. DIN is a *new* phase inserted at
the very start, before `interactive`/`hook`, that recaps *previously
completed* topics/subtopics related to this one.

1. Content source for "related prior topics": need a definition of
   "related" — same subject + already-completed (via
   `getCompletedTopicIds`/`getCompletedSubtopicIds` from
   `lib/supabase/progress.ts`, already exist) topics/subtopics that came
   before this one in `position` order. If none completed yet (first
   topic in the subject), DIN should either be skipped entirely or use
   generic subject-level recall questions — decide based on whether an
   empty DIN screen is worse than no DIN screen (recommend: skip if no
   prior completed content, don't force it).
2. Question source: cheapest option is 2-3 short-answer/MCQ pulled from
   already-generated questions for those prior topics/subtopics
   (`getQuestionById`-adjacent lookups, reuse `QuickCheck` component)
   rather than a new AI generation call per lesson load — keeps this free
   and instant. Only fall back to AI generation if no prior questions
   exist for the related topics.
3. Add `{ phase: "din" }` to the `Step` union and `buildLessonPlan()` in
   `lesson-player.tsx`, inserted before `interactive`/`hook`. Render using
   the existing `QuickCheck` component, same visual treatment as the
   `check` phase but with a "DIN — Do It Now" label instead of the
   section heading badge.
4. This needs the related-topics list as a new prop threaded from
   `app/learn/[topicId]/page.tsx` (query completed sibling topics server-side
   before rendering `LessonPlayer`).

**Verification**: complete two topics in the same subject in order,
open the third topic's lesson, confirm a "Do It Now" screen appears first
recapping content from the first two before the normal lesson starts;
confirm opening the very first topic in a subject with nothing completed
yet either skips DIN cleanly or degrades gracefully.

---

## Suggested execution order

Phase 1 → Phase 2 → Phase 3 (mastery chain, each depends on the last) →
Phase 4 (independent, can run anytime) → Phase 7 (independent) → Phase 5
(independent, smallest) → Phase 6 (benefits from Phase 4 landing first so
regenerate actually has new spec context to pick up, but not a hard
dependency).
