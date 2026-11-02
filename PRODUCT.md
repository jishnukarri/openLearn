# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a GCSE student (UK, roughly ages 14–16) revising independently at home, self-directed rather than assigned by a school. Teacher and admin roles exist and are actively built (class rosters, assignments, paper marking, content generation) but are secondary to the core student use case, not the primary adoption path.

- **Student** — picks subjects/exam boards, works through AI-generated lessons, practice questions, and flashcards, gets AI-marked feedback strictly against the real exam board markscheme.
- **Teacher** — manages classes, assigns topics/subtopics to students, uploads and marks question papers (AI-assisted extraction, splitting by student, and marking), forks/customizes base content for their class.
- **Admin** — configures subjects, exam boards, and spec content that generation is built from; reviews flagged content reports.

## Product Purpose

OpenLearn makes GCSE exam content easier to access and revise through AI, without being boring: interactive lessons and engaged, game-like feedback in place of static study material. It's a Duolingo/Brilliant-style study app, not a generic flashcard or notes tool.

Success is not yet defined — this is pre-launch with no real user cohort yet, so no retention, engagement, or outcome bar exists to design against. Treat it as build-out toward launch readiness, not optimization against a measured metric.

## Positioning

The differentiating mechanism is **strict-to-markscheme AI marking**: student answers (typed or scanned/photographed) are marked against the exam board's actual markscheme, not a generic AI rubric, with feedback shown as direct annotation over the student's own submission. Generic study/flashcard apps and general AI tutors don't do this; it is the one moment the product is built to prove itself in.

## Operating Context

- Content pipeline: admin pastes/uploads exam board spec text, AI generates topics from it; per-topic and per-subtopic lessons/questions/flashcards are pregenerated and cached, not built live per student.
- Paper-marking pipeline: teacher uploads a question paper + markscheme (PDF/image, single or multiple files); AI structures it into gradeable questions. Teacher builds a class roster (platform students get a reference code, non-platform students are added as custom entries). Teacher bulk-uploads scanned/photographed answer scripts (PDF, image, or .zip); AI splits by detected reference code, marks each student's script, and produces per-student feedback.
- Lessons run as a single full-page interactive sequence (pre-lesson widget → hook → teach/check pairs → flashcard/AI-tutor checkpoints → recap), not a page-per-question flow.
- PWA: installable, `start_url` is `/dashboard`, standalone display — students are expected to treat it like an app, not just a website.

## Capabilities and Constraints

- Stack: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4, Supabase (Postgres, RLS-enabled but authorization enforced at the Server Action layer rather than via RLS policies), Appwrite for auth sessions and file storage. AI generation/marking runs against a pluggable provider (OpenRouter/Hack Club/Gemini) configured by the admin through the server environment.
- Known gaps (do not treat as implemented, do not design around them as if solved): flashcards exist as two unrelated decks (in-lesson vs. standalone) with no unified mastery/spaced-repetition hub; no cross-topic revision view; a student can ace practice questions without a topic auto-completing; exam specs are stored as plain text only, not RAG-indexed; the admin reports queue doesn't deep-link to the flagged content; no plain "regenerate lesson" action for admins; no pre-lesson recap ("Do It Now") of prior related topics.

## Brand Commitments

- Name: **openLearn** (lowercase "open", capital "Learn" in the wordmark/manifest short name).
- Existing palette logic (documented in README, implemented in `app/globals.css`): indigo as the primary brand/chrome color; coral reserved strictly for celebration moments (streaks, unlocks, correct-answer bursts) and never used as general UI; amber reserved strictly for XP/progress; conventional green/red for success/error. Neutrals use a warm near-black rather than pure black to keep the playful, game-like screens from feeling cold.
- Positioned explicitly against Duolingo (cartoon path/mascot) as a reference to avoid — the brand wants to read as exam-serious, not childish, while keeping Duolingo/Brilliant-style engagement mechanics.

## Evidence on Hand

None. Pre-launch, no real users, no pilot, no usage data, no testimonials or case studies. Future design and copy work must not fabricate any of these — no invented review counts, star ratings, "trusted by" claims, or student quotes.

## Product Principles

1. Engagement and interactivity are the differentiator over "boring" static study content, but never at the cost of exam accuracy — the AI marking must hold up to the same standard as a real markscheme.
2. Student-facing design should read as exam-serious and credible (GCSE-age but not childish), while teacher/admin surfaces are utility-first tools, not the product's showcase.
3. Don't design or write copy as if the product has traction it doesn't have yet (no users, no data) — build for launch readiness, not for optimizing an unmeasured metric.
4. The three brand accent colors (indigo/coral/amber) each have exactly one job; a new UI element reaching for a "nice color" instead of chrome/celebration/progress is a brand violation, not a style choice.

## Accessibility & Inclusion

No product-specific requirement has been established beyond general web accessibility practice (the codebase already applies `prefers-reduced-motion`, focus-visible states, and semantic landmarks). Treat standard WCAG AA as the working bar until told otherwise.
