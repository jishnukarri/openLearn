# OpenLearn — Tasks

Source of truth for scope: [openlearn_project_spec memory](/) (product spec), [DESIGN.md](DESIGN.md) (visual system).

## Foundation

- [x] Navbar component (sticky, theme-aware, brand tokens, dropdown for account/logout)
- [x] Theme token system (`app/globals.css`) — dark ink default + light variant
- [x] Design format doc + reference mockup (`DESIGN.md`)
- [x] Supabase project created (`openlearn`, eu-west-2, DB-only — no Supabase Auth)
- [x] Core schema: `profiles`, `classes`, `class_members` (RLS on, server-only access)
- [x] Supabase server client (`lib/supabase/server.ts`, service-role)
- [x] Appwrite project connected, server client (`lib/appwrite/server.ts`, API key + session client)
- [x] `.env.local` populated (Supabase + Appwrite credentials)
- [x] **Unified multi-provider AI client** (`lib/ai/client.ts`) — single file all generation goes through, supports Ollama / OpenRouter / Hack Club AI / Gemini, resolves per-request based on who's asking (see below)

## AI provider architecture

`lib/ai/client.ts` is the one file every AI call goes through (`chatJson()`). All five generation modules (`topics.ts`, `lessons.ts`, `questions.ts`, `marking.ts`, `diagnostic.ts`) call it instead of touching a provider SDK directly.

- **Which key gets used is resolved per-request** via `resolveProviderConfig(profileId)`: if the acting profile is a **teacher with their own key saved** (`teacher_ai_settings` table, set at `/teacher/settings`), that key/provider is used; every other caller (students, admin-triggered generation, system pregeneration on publish) falls through to the **platform default** configured in `.env.local` (`AI_PROVIDER` + provider-specific vars). This is threaded through literally every call site — admin actions, student lesson/practice pages, diagnostic generation, marking.
- **Admins configure `.env.local` only** — no per-admin key UI, by design (`/admin/settings` is read-only status, points at the env vars).
- **Teachers add a key directly in the platform** at `/teacher/settings` — provider (Gemini/OpenRouter/Hack Club AI/Ollama) + key + optional model/host. Leaving the key field blank on save keeps the existing saved key (never re-displayed, so you're not forced to retype it just to change the model).
- **Currently running OpenRouter** (`google/gemini-2.5-flash` via `OPENROUTER_MODEL`) as the platform default — live-verified with a real API key and real cost tracked ($0.0003/call). Ollama (`qwen2.5:7b-instruct`, local, no usage limits, slow CPU inference) and Gemini direct are both still fully wired and switchable via `AI_PROVIDER`.
- **Hack Club AI** (`ai.hackclub.com`, OpenAI-compatible, free for Hack Club members) added as a fourth option — shares the same request path as OpenRouter (`chatJsonOpenAICompatible`), just a different base URL/default model (`qwen/qwen3-32b`). Not live-tested (no Hack Club key on hand), but structurally identical to the OpenRouter path that has been verified.
- **Fixed a real bug found during OpenRouter verification**: without an explicit `max_tokens`, some models default to requesting far more tokens than a low-credit account can afford, causing a `402` even though the actual response is tiny. Capped at 4096 for both OpenAI-compatible providers — confirmed this alone turned a failing request into a working one.
- Structured JSON output only works reliably with an **object-rooted schema** (`{topics: [...]}`), not a bare array root — every schema in `lib/ai/*` follows this; Gemini additionally needs its schema converted to the SDK's `Type` enum (`toGeminiSchema()` in the client), OpenRouter/Hack Club's `json_schema` response format takes the plain schema as-is.
- If Ollama becomes the active provider again: it's **not a system service** in this environment (installed to `~/.local/ollama`, no sudo available) — run [scripts/start-ollama.sh](scripts/start-ollama.sh) to bring it back up after any restart.

## Auth & sessions

- [x] Sign-up flow (Appwrite `Users.create` + admin-minted session) → creates matching `profiles` row in Supabase
- [x] Login flow (password verified via `Account.createEmailPasswordSession`, real session minted via `Users.createSession`) → session cookie
- [x] Session cookie handling (httpOnly, secure in prod) + `getSession()`/`requireSession()`/`requireRole()`/`requireAnyRole()` DAL helpers
- [x] Logout (delete Appwrite session + cookie)
- [x] Route protection (`proxy.ts` optimistic cookie check + auth-route bounce; DAL does the real verification close to the data)
- [x] Role-based redirect (`lib/roles.ts` — student→/onboarding, teacher→/teacher/classes, admin→/admin/subjects; used by login and the navbar profile chip)
- [x] Account settings page (`/account` — edit name, view role/XP/streak) + account deletion (type-to-confirm, deletes Appwrite user + Supabase profile + cascaded data)

## Student onboarding

- [x] Class + subject + exam board picker (`/onboarding` — invite-code join form + subject/exam-board checklist; not the full chat-bubble animation from DESIGN.md, but functionally equivalent)
- [x] "Started syllabus already?" branch — routes to fresh diagnostic intro or recap topic picker
- [x] Diagnostic quiz generation (up to 30 mixed questions: MCQ, fill-in-blank, matching, 2-6 mark short-answer) when starting fresh — `lib/ai/diagnostic.ts`
- [x] Topic-recap diagnostic (up to 3 topics sampled) when mid-syllabus — `/onboarding/topics`
- [x] Knowledge model built from diagnostic results, stored per student/subject/topic (`knowledge_model` table, weak-topic flag at <60%) — surfaced on `/dashboard`
- [x] Add more subjects after onboarding is done (`/dashboard/add-subjects`) — doesn't touch existing subjects, just adds new ones

## Admin dashboard

- [x] Unified admin panel at `/admin` with a side menu (`app/admin/layout.tsx` + `components/sidebar-nav.tsx`) — Subjects / Accounts / AI Settings, role-gated once at the layout level; `/admin` itself redirects to `/admin/subjects`
- [x] Subject create + exam board linking, and **delete** (`/admin/subjects`, admin-role-gated)
- [x] Spec input per subject+exam board — paste text **or upload a PDF/.txt/.md file** (`lib/extract-text.ts`, `unpdf`); a file wins over pasted text if both given. (Originally used `pdf-parse` v2, which crashed under Turbopack's server bundling — "fake worker" failure from pdfjs-dist's worker architecture; swapped to `unpdf`, built specifically for worker-free serverless PDF extraction, verified standalone against a real PDF)
- [x] Exam boards can be added directly in `/admin/subjects` (not just the 5 seeded ones) — small inline form, handles duplicate names gracefully; action accepts admin or teacher role
- [x] AI topic generation — **bulk** ("Generate All Topics", spec-grounded when available), **single** ("Generate one topic" with an optional hint, or leave blank and the model picks the next syllabus gap), and **manual** ("Add a topic by hand" — name + summary, no AI)
- [x] **Lessons generate as soon as a topic exists**, not just on publish — every path that creates a topic (bulk generate, single generate, manual add) immediately kicks off `pregenerateTopicContent`. Publish still re-checks as a safety net for anything that failed partway
- [x] Topic and subtopic **delete** (full CRUD, not just create+publish)
- [x] **"View & try lesson" / "Try practice question" links** per topic — opens `/learn/[topicId]` and `/practice/[topicId]` in a new tab; admin/teacher can go through the real lesson and practice flow themselves (XP isn't awarded, banner says "Previewing as admin/teacher")
- [x] **AI lesson tweaking** — on the lesson page, admin/teacher gets a "tweak this lesson" box: free-text instruction ("add a diagram description to section 2") regenerates the lesson incorporating it, on top of the existing content rather than a blind full regen
- [x] Subtopic generation nested under each topic (Duolingo/Brilliant-style collapsible accordion)
- [x] Publish flow — **cascading**: publishing a subject publishes all its topics + subtopics; publishing a topic publishes all its subtopics
- [x] Manage student/teacher accounts (`/admin/users` — role changer)
- [x] AI settings page (`/admin/settings`) — live status ping (Ollama) or config display (OpenRouter/Gemini), shows active provider/model, lists every env var, explicitly documents "admins use .env, teachers use `/teacher/settings`"

## Teacher dashboard

- [x] Unified teacher panel at `/teacher` with a side menu (`app/teacher/layout.tsx`) — Classes, AI Settings
- [x] Class CRUD (create/list/delete, collision-safe invite codes) — edit still open
- [x] Add students — invite code (student pastes in onboarding) + invite link (`/join/[code]`, auto-joins on visit); email invites not built (no email service configured)
- [x] **Add own AI key** (`/teacher/settings`) — provider (Gemini/OpenRouter/Ollama) + key + optional model/host, stored in `teacher_ai_settings`; used automatically for any generation `resolveProviderConfig` resolves against that teacher's profile id
- [x] Customize admin-published subjects per class — teachers attach an optional note to each assignment (e.g. "Focus on part b for the mock"), shown to students on that assignment's dashboard card. Content itself (lesson/question) stays shared per-topic, not forked per-class — a full per-class content fork would be a much bigger schema change
- [x] Import/export subjects across classes — "Copy set work from another class" on `/teacher/classes`, copies a source class's assignments (incl. notes) into another of the teacher's classes, skipping topics already assigned there
- [x] Set work for a class (`/teacher/classes` — assign a published topic to a class, with an optional note; students see it as "Set work" on their dashboard)

## Custom instructions

- [x] Per-subject custom instructions field (`/admin/subjects`) — folded into topic generation prompts (`lib/ai/topics.ts`), including single-topic generation
- [x] Per-topic custom instructions field, inside each topic's accordion — folded into that topic's lesson (`lib/ai/lessons.ts`) and question (`lib/ai/questions.ts`) generation prompts, including "simplify it", "try a similar question", and the AI tweak box

## Lessons & interactivity

- [x] Interactive lesson player (`/learn/[topicId]`) — Duolingo-style step-by-step slides, inline quick-check MCQ per section, segmented progress bar, celebration screen on completion
- [x] Question generation matching real exam style per board (`lib/ai/questions.ts`)
- [x] "This is too hard — simplify it" — regenerates the lesson in a slower, simpler style
- [x] "Tweak this lesson" (admin/teacher only) — free-text AI revision on top of existing content
- [x] Content pre-generation on topic creation (not just publish) — `lib/content-pipeline.ts`
- [x] Admin/teacher preview mode — `requireAnyRole` lets them open real student pages without earning XP

## Marking ("The Markup")

- [x] Markscheme generation (3–5 points) alongside each question
- [x] Model answer generated alongside each question, shown collapsed in the feedback panel after submitting
- [x] Text answer input (typed) — `/practice/[topicId]`
- [ ] Image/PDF upload for handwritten answers
- [ ] QR code hand-off (desktop → phone photo upload, multi-image)
- [x] AI marking against markscheme, strict grading, direct second-person feedback
- [x] Feedback UI — point-by-point ✓/✗, side-by-side with the answer form on desktop, sticky on scroll
- [x] "Try a similar question" — generates a fresh question for the same topic without leaving the page

## Self-study vs set work

- [x] Self-study mode (`/dashboard` — student picks any published topic for their subjects)
- [x] Set work mode (teacher-assigned via `/teacher/classes`, shown as a distinct "Set work" section on the student dashboard)
- [x] Progress/XP tracking (10 XP/mark on practice answers, 20 XP per completed lesson — students only, admin/teacher previews don't earn XP)
- [x] Streak tracking (`profiles.streak_count`, daily bump logic in `lib/supabase/progress.ts`)

## Known gaps / not built

- Real per-class content forking (right now "customize per class" is a note attached to the assignment, not a separate lesson/question variant per class)
- "Generate All Topics" is not idempotent — clicking it again appends duplicate topics rather than replacing (the new single-topic/manual-add paths don't have this problem since they always add exactly one)
- Mindmaps/concept trees, drag-and-drop question types, code sandbox, KaTeX math rendering, onboarding product tour — suggested libraries not integrated, out of scope for this pass
- **Ollama is not a system service** if it becomes the active provider again — must be manually restarted via `scripts/start-ollama.sh`
- Hack Club AI provider path is implemented and type-checked but not live-tested (no key on hand) — structurally identical to the now-verified OpenRouter path

---

## Bugs to fix

- [ ] **Matching question one-to-one enforcement** — currently possible to match multiple left-side items to the same right-side option; should be strictly 1:1 (selecting a right that's already matched should swap, not double-assign). Affects `MatchingBoard` component and the `match-connect` interactive component.
- [ ] **Subject list stale after add** — after creating a subject or topic in admin, the list doesn't update until a full page reload. `revalidatePath` calls exist but either the path string is wrong or client-side router cache isn't being busted. Pressing the action button multiple times while it's processing also causes an error (double-submit with a race on the DB insert).
- [ ] **Double-submit on slow actions** — any server action that takes >1s (AI generation, publish) can be double-triggered by impatient clicks; second call errors without a visible message. Fix with `useFormStatus` `pending` lock or `startTransition` guard.

---

## Upcoming features

### UX / navigation
- [ ] **Page transition progress bar** — thin bar at the very top of the page (above the navbar) that animates left→right on route changes; slows to ~80% while waiting for data, completes on paint. Use `nprogress` or a lightweight custom implementation with the Next.js `useRouter`/`NProgress` pattern.
- [ ] **Loading skeleton / spinner for content generation** — any page that is waiting for AI-generated content (lesson, questions, flashcards) shows a centred loading state instead of blank space. Extend the existing `loading.tsx` files in `/learn/[topicId]` and `/practice/[topicId]` and add them to the new bank/clarification pages built in the last session.
- [ ] **Better animations across the site** — replace the ad-hoc `transition-all` classes with a coherent motion system: entrance fade+slide for cards, staggered list reveals, smooth height transitions for accordions. The `springs` util and `@react-spring/web` are already in the project — standardise on them.
- [ ] **Footer bar** — a minimal site footer with: "Powered by AI — content may contain errors, always verify", links to Terms/Privacy, and a small OpenLearn wordmark. Show on marketing/auth pages; hide inside the app shell (admin, teacher, student dashboard).

### Auth & accounts
- [ ] **Teacher account requires admin approval** — when a user signs up with role=teacher (or requests a role upgrade), flag the account as `pending_approval`; block teacher-only routes until an admin approves from `/admin/users`. Add an "Approve / Reject" action column to the users table.
- [ ] **AI content disclaimer in footer** — small italic note in the app footer (and on lesson/practice pages): "AI-generated content — verify against your syllabus before exams."

### Student experience
- [ ] **Skip lesson if diagnosis already passed** — on the topic page/dashboard card, if the student's `knowledge_model` entry for this topic is already above the pass threshold (≥60%), show a "You already know this — go straight to practice" shortcut that links directly to `/practice/[topicId]` and marks the lesson as implicitly complete.
- [ ] **Revision tab** — a dedicated `/revision` route in the student nav. Shows topics the student has completed but whose `knowledge_model` score has decayed (time-weighted), plus any topics they struggled with in practice. Entry point for spaced-repetition flashcard review and re-doing practice questions.
- [ ] **Spaced repetition for flashcards (Anki-style)** — flashcard sessions should track last-reviewed + confidence per card (SM-2 or a simplified bucket system). Cards due for review surface in the Revision tab. Schema: add `flashcard_reviews` table (`card_id`, `student_id`, `ease`, `next_due`).
- [ ] **Topic strength / mastery battery** — visible per-topic indicator (like Duolingo's strength bar or a battery icon) derived from: lesson completed + practice score + last-reviewed date. Decays over time. Show on the student dashboard topic cards.
- [ ] **Better lock symbol on subject map** — replace the current text/basic lock with a Duolingo-style padlock SVG on locked topic nodes in the subject map. Animate unlock on first completion.

### Sharing & collaboration
- [ ] **Copy / share link for topics and lessons** — "Share this topic" button on lesson and practice pages copies a direct link. Optionally: "Send by email" opens a mailto: with the link pre-filled (no email service required).
- [ ] **Student management features** — on the teacher's class page, add: search/filter students by name, bulk-remove students, view per-student progress (topics completed, XP, last active) in a mini-report panel per class.

### AI tools
- [ ] **AI paper marking** — a standalone tool (separate from the per-topic practice flow) where any student can: upload a photo/scan of an exam question from a real paper, select subject and question type, and get it marked against an AI-generated markscheme. Route: `/mark` or `/tools/mark`. Reuses `markAnswerFromImages` and the existing upload session infra.
- [ ] **AI whiteboard** — freehand drawing canvas where students can sketch diagrams, label them, and ask "Is this correct?" against the current topic's lesson content. Out of scope for near-term; park here for reference.

### Answer matching
- [ ] **Fuzzy / flexible answer matching** — for `short-answer` and `calculation` format questions, normalise both the student answer and the accepted list before comparing: strip leading/trailing punctuation, collapse whitespace, ignore comma spacing (so `3, 3, 3` matches `, 3 3,`), case-insensitive. Apply in `autoMark()` inside `lib/question-marking.ts`.
