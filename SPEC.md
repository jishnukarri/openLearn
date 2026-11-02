# openLearn — Specification

Status: pre-launch, no real users. Snapshot of the project as of 2026-10-13. Derived from the code, `PRODUCT.md`, `README.md`, `tasks.md` and `docs/superpowers/`. Where this file and the code disagree, the code wins.

## 1. Purpose

openLearn is a Duolingo/Brilliant-style GCSE (UK, ages ~14–16) study web app. AI makes exam content easier to access and keeps students engaged through interactive lessons, game-like feedback and flashcards. The differentiator is **strict-to-markscheme AI marking**: typed or photographed answers are marked against the exam board's markscheme, with feedback annotated over the student's own submission.

Success metrics are not yet defined. Build for launch readiness, not for an unmeasured metric, and never fabricate traction (reviews, "trusted by", quotes).

## 2. Users and roles

| Role | Home route | Purpose |
|---|---|---|
| `student` | `/onboarding` → `/dashboard` | Self-directed revision: lessons, practice, flashcards |
| `teacher` | `/teacher/classes` | Classes, assignments, paper marking, content forking and ownership of their own subjects |
| `pending_teacher` | `/pending-approval` | Teacher sign-up awaiting admin approval; blocked from teacher routes |
| `admin` | `/admin/subjects` | Subjects, exam boards, specs, content generation, reports, user support |
| guest | `/start` | Try the diagnostic without an account |

Routing is in `lib/roles.ts`. `proxy.ts` does only an optimistic cookie check. Real verification happens in the DAL (`requireSession` / `requireRole` / `requireAnyRole` in `lib/appwrite/session.ts`). A teacher manages a subject only if they created it (`canManageSubject`); admins manage all.

## 3. Architecture

- **Frontend/server:** Next.js 16 (App Router, Turbopack, Server Actions), React 19, TypeScript, Tailwind v4, shadcn/base-ui, framer-motion / react-spring, KaTeX math, installable PWA (`start_url=/dashboard`).
  - `AGENTS.md` warns that this Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before writing framework code.
- **Auth and files:** Appwrite. Sessions are minted server-side and held in an httpOnly cookie. Appwrite also handles uploaded-file storage.
- **Data:** Supabase Postgres, service-role access from the server only (DB-only, no Supabase Auth). RLS is enabled but authorization is enforced in Server Actions and the `lib/supabase/*` data layer, not by RLS policies.
- **AI:** all calls go through `chatJson()` in `lib/ai/client.ts`.
  - Providers: Hack Club AI (main) with OpenRouter as the automatic fallback; same models on both. Platform default comes from `AI_PROVIDER` and related env vars.
  - Output is JSON against object-rooted schemas.
  - OpenRouter/Hack Club can return errors inside an HTTP 200 body. The client surfaces them explicitly (e.g. 429 on free-tier models).
- **RAG:** `lib/rag.ts` — teacher reference documents are extracted, chunked, embedded and similarity-searched into generation prompts.
- **Rate limiting:** `lib/rate-limit.ts` — shared Postgres sliding window (`rate_limits` migration) with in-memory fallback.
- **Layout:** `app/` routes and `app/actions/*` server actions; `lib/supabase/*` data access; `lib/ai/*` generation and marking; `components/` (incl. `components/interactives/`); `supabase/migrations/`; `docs/superpowers/{specs,plans}`.
- **Tests:** Vitest (`npm test`), colocated `*.test.ts` — mastery, diagnostic selection, lesson plan/sanitize, question bank and marking, recommendations, roles, student analytics, rich text.
- **Deploy:** `deploy.sh`, `scripts/deploy-remote.sh`.

## 4. Functional scope — implemented

### 4.1 Auth and accounts
- Sign-up creates the Appwrite user and the Supabase `profiles` row. Login, logout and role-based redirect work.
- Teacher sign-ups become `pending_teacher` until an admin approves.
- Blocked accounts are told they are blocked at login.
- `/account`: edit name, view role/XP/streak, delete account (type-to-confirm; removes the Appwrite user, profile and cascaded data).

### 4.2 Content pipeline (admin/teacher)
- Subjects and exam boards: create, delete, add custom boards, copy a subject (`subject-copy`).
- Spec per subject + board: paste text or upload PDF/.txt/.md (`unpdf`). The spec is stored as plain text only.
- Topics: bulk AI generation from the spec, single generation with an optional hint, or manual add. Topic and subtopic CRUD, with subtopics nested under topics.
- Lessons, question banks and flashcards are pregenerated when a topic exists (`lib/class-content.ts`, `lib/subtopic-content.ts`, `lib/content-pipeline.ts`) and cached. Publish re-checks for anything that failed.
- Admin/teacher can preview any lesson or practice page (no XP awarded), tweak a lesson with free-text instructions, and request a simpler style.
- Teacher class forking: a class gets its own variant only once a teacher adds customization notes. Otherwise it shares the base generation.
- Teacher document upload feeds RAG.

### 4.3 Student journey
- **Onboarding:** join a class by invite code (`/join/[code]`), pick subjects and exam boards, then choose "fresh start" or "already started".
- **Initial diagnostic:** capped at 30 questions (`DIAGNOSTIC_MAX_QUESTIONS`), covering the start of each subject. Topics are taken in syllabus order, round-robin across subjects (`lib/diagnostic-select.ts`).
  - Question types: MCQ, fill-in-blank, matching, short answer (2–6 marks).
  - The mid-syllabus recap path samples up to `RECAP_MAX_TOPICS = 6` topics.
  - Results feed the `knowledge_model`.
- **Guest diagnostic:** `/start` runs the diagnostic with a guest session and shows results without an account.
- **Dashboard and subject map:** `/dashboard`, `/subjects/[id]` (subject path), `/dashboard/add-subjects`. Assigned work from teachers is surfaced via recommendations (`lib/recommendations.ts`).
- **Lessons** (`/learn/[topicId]`, `/learn/subtopic/[id]`):
  - One full-page sequence: pre-lesson interactive (slider sim, branching, graph transformer, block sort, flowchart sort, categorize — one archetype per subject), then hook, teach/check pairs, flashcard and AI-tutor checkpoints, and recap.
  - Quick-checks are auto-marked: MCQ, multi, short, matching.
  - Open answers get a 3-mark AI rubric.
  - Adaptive reteach: a wrong answer triggers a background rewrite of the next section.
  - Sticky AI tutor sidebar with topic and section context.
  - Scroll-to-advance with button fallback.
  - Lesson and generated content are sanitized on generation and on read.
- **Practice** (`/practice/[topicId]`, subtopic variant): AI marking against the generated markscheme plus auto-marked objective and structured formats. Photo/scan answer upload is marked via vision. Phone hand-off uses a public temporary upload link (QR code, no login). A question-bank/session mode tracks mastery exit (`question_sessions`, `question_session_attempts`).
- **Flashcards** (`/flashcards/[topicId]`, subtopic variant): standalone AI deck plus in-lesson cards with Hard/Good/Easy rating.
- **Progress:** XP and streak, topic/subtopic completion, student progress component and analytics (`lib/student-analytics.ts`).
- **Mastery** (`lib/mastery.ts`):
  - Score = 0.3 × diagnostic + 0.5 × accuracy × confidence + completion bonus (0.1 lesson, 0.1 recall) discounted by `(1 − confidence × (1 − accuracy))`.
  - Accuracy is recency-weighted over the newest 20 answers with a 14-day half-life.
  - Confidence is `min(1, effective attempts / 10)`.
  - Scores can rise and fall. A bulk `getTopicMastery` fetch exists.
  - It is currently being wired into the subject map and student progress views (uncommitted changes in `app/subjects/[subjectId]/*`, `components/student-progress.tsx`, `lib/supabase/student-analytics.ts`, `lib/mastery.test.ts`).

### 4.4 Teacher
- **Classes:** `/teacher/classes` with roster, invite code, per-class progress overview, per-student progress, and assignments of topics/subtopics.
- **Subjects:** `/teacher/subjects` lists the teacher's own subjects, which they own and manage.
- **Paper marking pipeline** (`/teacher/mark`, `/teacher/papers/...`):
  1. Upload a question paper + markscheme (PDF/image, multiple files). AI extracts gradeable questions (`lib/ai/paper-extraction.ts`).
  2. The teacher reviews and edits the extraction.
  3. The teacher builds a roster. Platform students get a reference code, non-platform students are custom entries.
  4. The teacher bulk-uploads scanned scripts (PDF, image or .zip). The AI splits by reference code and marks each student's script (`lib/ai/paper-marking.ts`, `lib/paper-marking-grouping.ts`).
  5. The teacher views per-student results.
- **Settings:** own AI provider/key/model (key never re-displayed).

### 4.5 Admin
- Subjects, exam boards and specs (see 4.2).
- **Accounts** (`/admin/users`): search, role filter, pagination, last-active, delete user, approve/reject teachers.
- **Student page** (`/admin/users/[profileId]`): progress view plus a support panel with confirm dialogs for reset password, sign out everywhere, block/unblock, and mark email verified. Each action requires a reason and is written to `admin_audit_log` (`lib/supabase/admin-audit.ts`), shown as an audit list on the page.
- **Reports** (`/admin/reports`): student-submitted content reports with a queue.
- **Settings** (`/admin/settings`): read-only AI provider status (configuration is via env).

### 4.6 Content reports
- A student can report an issue on any lesson. The flow is report → optional instant regeneration → escalate to the admin queue if still broken.

## 5. Data model (Supabase, main entities)

`profiles` (role, XP, streak, blocked/verified flags), `classes`, `class_members`, `subjects` (with `archetype`, `created_by`), `exam_boards` (`spec_text`), `topics` (per exam board), subtopics, lessons, `questions` (section_index, bank_position, verified, image_url), `question_sessions`, `question_session_attempts`, flashcards, `topic_documents` and embeddings, `knowledge_model`, diagnostic sessions/answers/pool, assignments, papers / paper submissions / practice uploads, `content_reports`, `teacher_ai_settings`, `rate_limits`, `admin_audit_log`. Migrations live in `supabase/migrations/` (latest: `20261012_rate_limits`, `20261013_admin_audit_log`). Apply them to the live DB. A past outage came from an unapplied `question_bank` migration.

## 6. Non-functional requirements

- **Authorization:** every Server Action and data-layer function checks the role and ownership itself, because RLS is not the control. All Supabase access is server-side with the service-role key.
- **Security:** sanitize rich text and AI output (`dompurify`, `sanitize-html`, `lesson-sanitize`). Rate-limit abusable endpoints. Never expose provider keys. Audit privileged admin actions.
- **Accessibility:** WCAG AA as the working bar. Respect `prefers-reduced-motion`, keep focus-visible states and semantic landmarks, and announce AI loading states to screen readers.
- **UX feedback:** AI-backed actions show pending state or an overlay (`pending-ai-overlay`, `ai-loading`). AI failures show a dedicated error screen.
- **Brand:** the name is "openLearn". Indigo is chrome and path, coral is celebration only, amber is XP/progress only, green/red are success/error. The tone is exam-serious, not childish. See `DESIGN.md`.
- **Reliability of AI output:** schemas are object-rooted and `max_tokens` is capped (4096) on OpenAI-compatible providers. Provider errors embedded in HTTP 200 bodies must surface with their code and message.

## 7. Known gaps and backlog

From `README.md`, `PRODUCT.md` and `tasks.md`. Do not treat these as implemented.

**Learning features**
- Two unrelated flashcard decks (in-lesson vs standalone), with no persisted ratings and no spaced repetition. Planned: `flashcard_reviews` (`card_id`, `student_id`, `ease`, `next_due`).
- No `/revision` hub for decayed or weak topics.
- Mastery battery on topic cards (in progress, see 4.3).
- No auto-complete of a topic by practice mastery, and no "skip lesson if already passed" shortcut.
- No "Do It Now" recap opener.
- Exam spec is plain text only, not RAG-indexed, and the original file is not kept.

**Marking**
- Fuzzy answer matching for short-answer and calculation questions in `autoMark()` (`lib/question-marking.ts`).
- Matching questions should be strictly 1:1.
- Standalone student `/mark` tool for a single exam question.

**Admin/teacher**
- Reports don't deep-link to the flagged content.
- No plain "regenerate lesson" action.
- Teacher student-management extras (search, bulk remove).
- Open items: double-submit protection on slow actions, stale subject list after add, page-transition progress bar, motion-system standardisation, footer with AI disclaimer and Terms/Privacy links, better lock icon on the subject map, share-link button.

**Operational**
- The default free OpenRouter model (`z-ai/glm-5.2:free`) is rate-limited (429). Move to a paid or credited model before launch. The API key was exposed in terminal output and must be rotated.
- DNS in the dev environment failed to resolve the Supabase project host (local gateway resolver). Check the network before diagnosing app errors.
- No real users, pilot or usage data exists.

## 8. Out of scope (for now)
- AI whiteboard / freehand drawing check.
- Email delivery services (share links use `mailto:` only).
- Optimizing against engagement or retention metrics.

## 9. Definition of done for launch readiness (proposed)
1. All migrations applied. A fresh-environment setup works end to end for each role.
2. A paid, reliable AI provider is configured and all keys are rotated.
3. Flashcard ratings persist and the revision hub works.
4. Mastery is shown consistently on the dashboard and subject map.
5. Admin report deep-linking and regenerate-lesson are in place.
6. The AI disclaimer and legal footer are present, and the accessibility pass (WCAG AA) is complete.
7. `npm test`, `npm run lint` and `npm run build` pass.
