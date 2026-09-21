# OpenLearn


Palette logic: indigo as the primary brand/path color (calmer and more distinctive than Duolingo's green, still reads as trustworthy and modern), coral reserved for celebration moments (streaks, unlocks, correct-answer bursts), and amber specifically for XP/progress so it never gets confused with the coral "you did something great" accent. Success/error stay conventional green/red since that's a place you want instant recognition, not branding. Neutrals stay a warm near-black rather than pure black, which reads softer on the playful, game-like screens this app is going for.

Short project description:

OpenLearn is a self-built, Duolingo/Brilliant-style GCSE study app. 
It is a app which solves the issue of accessing the content easier thorugh AI. Instead of making it boring it uses interactiveness and more engaging feedback to keep the student more focused on studying

## Current progress

Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Supabase (Postgres + Auth via Appwrite sessions) · Tailwind v4. AI generation runs against a pluggable provider (Ollama/OpenRouter/Hack Club/Gemini), selected per-request in `lib/ai/client.ts`, with a teacher's own key overriding the platform default.

### Built and working

**Content pipeline**
- Admin subject/exam-board setup, spec text paste (per exam board), AI topic generation from spec + custom instructions.
- Per-topic and per-subtopic lesson/question/flashcard generation, pregenerated at content-creation time and cached (`lib/class-content.ts`, `lib/subtopic-content.ts`).
- Teacher class forking — a class gets its own lesson/question variant only once a teacher attaches customization notes, otherwise everyone shares the base generation.
- RAG for teacher-uploaded reference documents: upload → extract → chunk → embed → similarity search, folded into generation prompts (`lib/rag.ts`, `lib/supabase/topic-documents.ts`).

**Lessons** (`app/learn/[topicId]/lesson-player.tsx`)
- Full-page, full-width interactive lesson sequence: pre-lesson interactive widget (slider sim / branching / graph / block sort / flowchart / categorize, one of six archetypes per subject) → hook → repeating teach/check pairs → interspersed flashcard and open-ended AI-tutor checkpoints → recap.
- Auto-marked quick-checks (mcq/multi/short/matching) plus AI-marked open-answer tutor questions with a 3-mark rubric.
- Adaptive re-teaching: a wrong quick-check answer triggers a background AI call that lightly rewrites the next section before the student reaches it.
- Sticky AI tutor sidebar (topic + section context aware) alongside the main lesson content.
- Scroll-to-advance navigation — scrolling to the bottom of a step auto-advances (with a "⋯" hint), buttons remain as a fully functional fallback.
- Flashcard rating (Hard/Good/Easy, keys 1/2/3) built into the in-lesson flashcard checkpoint.
- Student-facing "Report an issue" on every lesson, wired to a report → optional instant regeneration → escalate-if-still-broken flow.
- Defensive sanitization at generation and read time: runaway repeated-character AI glitches get collapsed, and interactives that generated with no actual content (empty sliders/choices/blocks/etc) are dropped instead of rendering a broken widget.

**Practice**
- AI-marked extended answers against a generated markscheme, plus auto-marked structured/objective formats.
- Photo/scan answer upload, marked via vision.
- A question-bank/session mode with mastery-exit tracking (`question_sessions` / `question_session_attempts`).

**Platform**
- Role-gated dashboards for student/teacher/admin (Appwrite session + Supabase profile role).
- Content reports (`content_reports`) with an admin queue at `/admin/reports`.
- XP + streak tracking, topic/subtopic completion tracking.
- Diagnostic onboarding flow (subject/exam-board pick, syllabus-progress questions) — see `lib/diagnostic-scoring.ts`.

### Known gaps / not yet built
- **Flashcards are two separate decks today** — the in-lesson flashcard checkpoint derives cards from section text on the fly; the standalone `/flashcards/[topicId]` page generates its own AI deck. Not yet unified.
- **No cross-topic mastery score or spaced-repetition revision hub** — flashcard ratings aren't persisted anywhere yet, so there's no "revise everything you've studied" view.
- **No auto-complete-by-practice-mastery** — a student who aces the exam questions for a topic still has to open the lesson to have it marked complete.
- **Exam spec is text-only, not RAG-indexed** — specs are pasted/extracted-then-discarded as plain text (`exam_boards.spec_text`); the original PDF isn't kept and spec content isn't chunked/embedded like teacher reference docs are, so lesson generation and the AI tutor can't cite it precisely.
- **Reports don't deep-link** — `/admin/reports` lists flagged content but doesn't jump the admin to the actual lesson/question page.
- **No plain "regenerate lesson" action** — only "simpler style" and instruction-based "tweak" exist; there's no explicit "just regenerate with current context" button for admins.
- **No DIN ("Do It Now") opener** — no pre-lesson recap of previously completed, related topics; each lesson starts cold.

A phased implementation plan for these gaps lives at [`docs/plans/2026-08-14-platform-upgrades.md`](docs/plans/2026-08-14-platform-upgrades.md).

### Recently fixed
- A pending Supabase migration (`question_bank`) had never actually been applied to the live DB — `questions.section_index/bank_position/verified/image_url` and the question-session tables were missing, breaking exam-question generation for subtopics with a `42703` error.
- The AI-tutor open-answer marking action was resolving the wrong id (subtopic id passed where a topic id was expected) in subtopic-mode lessons, throwing "Topic not found."
- Matching-pair quick-checks ("Match X with Y") could get selected as the open-ended tutor question, which makes no sense as a free-text essay prompt — the lesson planner now skips matching-kind sections for that slot.
- A stale `interactive.kind !== "block_sort"` guard caused block-sort lessons to silently regenerate on every single page load instead of using the cached version.
