# Paper Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher upload a question paper + markscheme (PDF/image, one or more files each) for one of their classes, have AI extract a structured, storable, per-question breakdown, review/edit it, and finalize it as a "ready" paper.

**Architecture:** New `papers`/`paper_questions` tables (a paper is class-scoped, not topic-scoped, unlike everything else in this codebase). A new `lib/ai/paper-extraction.ts` reuses `lib/ai/marking.ts`'s proven multi-image vision-call pattern (same provider-selection logic, same Gemini/Hack Club transport code) but for extraction instead of marking. A new `lib/supabase/papers.ts` CRUD layer, a new `app/actions/papers.ts` action layer, and three new routes: list/create, review, and detail.

**Tech Stack:** Next.js 16 Server Actions, Supabase (service-role client), Gemini/Hack Club vision APIs (via the same transport already proven in `lib/ai/marking.ts`).

## Global Constraints

- A paper belongs to exactly one class, chosen at creation — not reusable across classes (explicit design decision; a future multi-class paper would need a join table, not a reason to complicate this).
- Question paper and markscheme are uploaded as two separate file groups — never one combined upload.
- The extracted/edited question shape is exactly `{questionNumber: number, prompt: string, maxMarks: number, markscheme: {point: string}[]}` — this is deliberately identical to what `lib/ai/marking.ts`'s `markAnswer`/`markAnswerFromImages` already consume, so the later marking stage needs zero new marking logic.
- `papers`/`paper_questions` get RLS enabled with zero policies, matching this app's established pattern (authorization lives entirely in the Server Action layer via the service-role client; RLS is deny-all-by-default for defense in depth, not the enforcement mechanism — see `lib/appwrite/session.ts`'s `requireRole` pattern and the security audit fixes made earlier this session).
- Ownership check for a paper is a direct `paper.teacherId === profile.id` equality check (not `requireOwnerOrAdmin`, which is subject-specific) — matches `assertOwnsClass` in `app/actions/assign.ts`, the existing pattern for teacher-owned, non-subject entities.
- Run `npx tsc --noEmit` after each task; it must stay clean throughout.
- This repo has no Supabase/Appwrite mocking test harness. Verify DB-touching code via the Supabase MCP tools (`execute_sql`) against the live project and the running dev server in the browser — the established convention from every other feature built this session — not fabricated unit tests with unverified mocks.
- The one genuinely hard-to-unit-test piece is the AI extraction call itself (`extractPaperQuestions`) — verify it manually with a real small test paper (2-3 questions) during Task 3, not with a mocked "AI extracted this" test that would just assert the mock.

---

### Task 1: Database migration

**Files:** none (Supabase MCP `apply_migration` call, not a file in this repo)

- [ ] **Step 1: Apply the migration**

```sql
CREATE TABLE public.papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  class_id uuid NOT NULL REFERENCES public.classes(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.paper_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  prompt text NOT NULL,
  max_marks integer NOT NULL,
  markscheme jsonb NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_questions ENABLE ROW LEVEL SECURITY;
```

Apply via the Supabase MCP `apply_migration` tool (project id `cgahkcboiaherxajecys`), name `create_papers_tables`.

- [ ] **Step 2: Verify**

Run via the Supabase MCP `execute_sql` tool: `select table_name from information_schema.tables where table_name in ('papers', 'paper_questions');`
Expected: both rows returned.

Run via the Supabase MCP `get_advisors` tool (type `security`) to confirm no new `rls_disabled_in_public` findings for these two tables (they should show as `rls_enabled_no_policy`, an INFO-level finding, not an ERROR).

---

### Task 2: Data layer — `lib/supabase/papers.ts`

**Files:**
- Create: `lib/supabase/papers.ts`

**Interfaces:**
- Produces: `PaperQuestionInput`, `Paper`, `PaperQuestion` types; `createPaper(input: {teacherId, classId, title}): Promise<string>`, `replacePaperQuestions(paperId: string, questions: PaperQuestionInput[]): Promise<void>`, `getPaper(paperId: string): Promise<Paper | null>`, `getPaperQuestions(paperId: string): Promise<PaperQuestion[]>`, `markPaperReady(paperId: string): Promise<void>`, `listPapersForTeacher(teacherId: string): Promise<Paper[]>`

- [ ] **Step 1: Write the file**

```ts
// lib/supabase/papers.ts
import "server-only";
import { createServiceClient } from "./server";

export type PaperQuestionInput = {
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
};

export type Paper = {
  id: string;
  teacherId: string;
  classId: string;
  title: string;
  status: "draft" | "ready";
  createdAt: string;
};

export type PaperQuestion = {
  id: string;
  paperId: string;
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
  imageUrl: string | null;
};

export async function createPaper(input: {
  teacherId: string;
  classId: string;
  title: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("papers")
    .insert({ teacher_id: input.teacherId, class_id: input.classId, title: input.title })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Replace-all semantics: the review screen always submits the full edited
// set, so clearing first keeps this idempotent regardless of how many
// times a teacher revisits the review screen before finalizing.
export async function replacePaperQuestions(
  paperId: string,
  questions: PaperQuestionInput[]
): Promise<void> {
  const supabase = createServiceClient();
  const { error: deleteError } = await supabase
    .from("paper_questions")
    .delete()
    .eq("paper_id", paperId);
  if (deleteError) throw deleteError;

  if (questions.length === 0) return;

  const { error } = await supabase.from("paper_questions").insert(
    questions.map((q) => ({
      paper_id: paperId,
      question_number: q.questionNumber,
      prompt: q.prompt,
      max_marks: q.maxMarks,
      markscheme: q.markscheme,
    }))
  );
  if (error) throw error;
}

export async function getPaper(paperId: string): Promise<Paper | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("papers")
    .select("id, teacher_id, class_id, title, status, created_at")
    .eq("id", paperId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    teacherId: data.teacher_id,
    classId: data.class_id,
    title: data.title,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function getPaperQuestions(paperId: string): Promise<PaperQuestion[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("paper_questions")
    .select("id, paper_id, question_number, prompt, max_marks, markscheme, image_url")
    .eq("paper_id", paperId)
    .order("question_number");
  if (error) throw error;
  return (data as any[]).map((r) => ({
    id: r.id,
    paperId: r.paper_id,
    questionNumber: r.question_number,
    prompt: r.prompt,
    maxMarks: r.max_marks,
    markscheme: r.markscheme,
    imageUrl: r.image_url,
  }));
}

export async function markPaperReady(paperId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("papers").update({ status: "ready" }).eq("id", paperId);
  if (error) throw error;
}

export async function listPapersForTeacher(teacherId: string): Promise<Paper[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("papers")
    .select("id, teacher_id, class_id, title, status, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]).map((d) => ({
    id: d.id,
    teacherId: d.teacher_id,
    classId: d.class_id,
    title: d.title,
    status: d.status,
    createdAt: d.created_at,
  }));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Verify against the live database**

Using the Supabase MCP `execute_sql` tool, confirm a real teacher/class exist to test against (per this session's prior work: teacher `f1459ea6-a21b-457c-9eef-af628f8a97ee`, class `f5afcc92-5580-4c84-b4a5-d4011aa64e20` — "Y11"). Insert a throwaway paper row directly, confirm `getPaper`/`listPapersForTeacher`'s query shapes resolve (run the equivalent `select` via `execute_sql`), then delete the throwaway row. This is a lighter check than Task 3's full verification since Task 3 exercises this file for real anyway.

---

### Task 3: AI extraction — `lib/ai/paper-extraction.ts`

**Files:**
- Create: `lib/ai/paper-extraction.ts`

**Interfaces:**
- Produces: `ExtractedPaperQuestion` type, `extractPaperQuestions(input: {questionPaperImages: {bytes: Buffer, contentType: string}[], markschemeImages: {bytes: Buffer, contentType: string}[]}): Promise<ExtractedPaperQuestion[]>`

- [ ] **Step 1: Write the file**

This follows `lib/ai/marking.ts`'s exact provider-selection and transport pattern (same order of preference, same Gemini SDK call shape, same Hack Club fetch shape) — only the prompt and response schema differ, since that transport code is already proven working in this codebase.

```ts
// lib/ai/paper-extraction.ts
import "server-only";

export type ExtractedPaperQuestion = {
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionNumber: { type: "integer" },
          prompt: { type: "string" },
          maxMarks: { type: "integer" },
          markscheme: {
            type: "array",
            items: {
              type: "object",
              properties: { point: { type: "string" } },
              required: ["point"],
            },
          },
        },
        required: ["questionNumber", "prompt", "maxMarks", "markscheme"],
      },
    },
  },
  required: ["questions"],
};

const EXTRACTION_PROMPT =
  `You are given a question paper (one set of images) and its markscheme ` +
  `(a second set of images). Match questions across both documents by ` +
  `question number.\n\n` +
  `For each question, produce:\n` +
  `- questionNumber: the question number as printed (integer)\n` +
  `- prompt: the full question text, transcribed exactly, including any ` +
  `sub-parts (a), (b), etc. as part of the same prompt if the markscheme ` +
  `marks them as one question\n` +
  `- maxMarks: the total marks available for the question, from the ` +
  `markscheme (often shown in brackets like "[3 marks]" on the paper, or ` +
  `as a total in the markscheme)\n` +
  `- markscheme: an array of individual marking points a student's answer ` +
  `should be checked against, each as an object with a "point" field — ` +
  `one point per distinct fact/step that earns a mark, phrased so a marker ` +
  `(human or AI) can check "does the answer include this?"\n\n` +
  `Return every question found on the paper, in order. If a question has ` +
  `no clear markscheme match, still include it with your best-effort ` +
  `markscheme derived from question context.`;

export async function extractPaperQuestions(input: {
  questionPaperImages: { bytes: Buffer; contentType: string }[];
  markschemeImages: { bytes: Buffer; contentType: string }[];
}): Promise<ExtractedPaperQuestion[]> {
  const preferHackClub = process.env.AI_PROVIDER === "hackclub";
  const parsed =
    preferHackClub && process.env.HACKCLUB_API_KEY
      ? await extractViaHackClub(input)
      : process.env.GEMINI_API_KEY
        ? await extractViaGemini(input)
        : process.env.HACKCLUB_API_KEY
          ? await extractViaHackClub(input)
          : null;

  if (!parsed) {
    throw new Error(
      "Paper extraction needs a vision-capable AI key (Gemini or Hack Club) configured on the platform."
    );
  }

  return parsed.questions;
}

function imageParts(images: { bytes: Buffer; contentType: string }[]) {
  return images.map((img) => ({
    inlineData: { mimeType: img.contentType, data: img.bytes.toString("base64") },
  }));
}

async function extractViaGemini(input: {
  questionPaperImages: { bytes: Buffer; contentType: string }[];
  markschemeImages: { bytes: Buffer; contentType: string }[];
}): Promise<{ questions: ExtractedPaperQuestion[] }> {
  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACTION_PROMPT },
          { text: "Question paper:" },
          ...imageParts(input.questionPaperImages),
          { text: "Markscheme:" },
          ...imageParts(input.markschemeImages),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionNumber: { type: Type.INTEGER },
                prompt: { type: Type.STRING },
                maxMarks: { type: Type.INTEGER },
                markscheme: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { point: { type: Type.STRING } },
                    required: ["point"],
                  },
                },
              },
              required: ["questionNumber", "prompt", "maxMarks", "markscheme"],
            },
          },
        },
        required: ["questions"],
      },
    },
  });

  return JSON.parse(response.text ?? '{"questions":[]}') as { questions: ExtractedPaperQuestion[] };
}

async function extractViaHackClub(input: {
  questionPaperImages: { bytes: Buffer; contentType: string }[];
  markschemeImages: { bytes: Buffer; contentType: string }[];
}): Promise<{ questions: ExtractedPaperQuestion[] }> {
  const toImageUrl = (img: { bytes: Buffer; contentType: string }) => ({
    type: "image_url" as const,
    image_url: { url: `data:${img.contentType};base64,${img.bytes.toString("base64")}` },
  });

  const response = await fetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HACKCLUB_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.HACKCLUB_VISION_MODEL || "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "text", text: "Question paper:" },
            ...input.questionPaperImages.map(toImageUrl),
            { type: "text", text: "Markscheme:" },
            ...input.markschemeImages.map(toImageUrl),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", strict: true, schema: EXTRACTION_SCHEMA },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Hack Club paper extraction failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as { questions: ExtractedPaperQuestion[] };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification with a real small test paper**

This is the one piece that cannot be meaningfully unit-tested (per Global Constraints). Using whichever vision-capable provider is configured in `.env.local` (check `AI_PROVIDER`/`GEMINI_API_KEY`/`HACKCLUB_API_KEY` — this session's earlier work confirmed `AI_PROVIDER=openrouter` with a Gemini/Hack Club key also possibly present; check before assuming which path runs), write a throwaway script (same pattern as this session's `verify-subject-copy.mjs`: a plain `.mjs` file run from the project root so `node_modules` resolves) that:
1. Creates or fetches two small test images/PDFs — a 2-question mini "paper" and its markscheme (can be generated as plain text rendered to a simple image, or reuse any 2-question example available; the point is exercising the real vision call end-to-end).
2. Calls the same logic as `extractPaperQuestions` (replicate inline in the script, same as the subject-copy verification approach, since `server-only` blocks a direct import outside Vitest/Next).
3. Logs the result and confirms: exactly 2 questions returned, each with a plausible `questionNumber`, non-empty `prompt`, positive `maxMarks`, and non-empty `markscheme` array.

Delete the throwaway script after confirming.

---

### Task 4: Action layer — `app/actions/papers.ts`

**Files:**
- Create: `app/actions/papers.ts`

**Interfaces:**
- Consumes: `requireRole` from `@/lib/appwrite/session`; `extractPaperQuestions` from `@/lib/ai/paper-extraction` (Task 3); `createPaper`, `replacePaperQuestions`, `getPaper`, `markPaperReady` from `@/lib/supabase/papers` (Task 2); `createServiceClient` from `@/lib/supabase/server`
- Produces: `createPaperAction(formData: FormData): Promise<void>`, `savePaperReviewAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Write the file**

```ts
// app/actions/papers.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { extractPaperQuestions } from "@/lib/ai/paper-extraction";
import { createPaper, replacePaperQuestions, getPaper, markPaperReady } from "@/lib/supabase/papers";
import { createServiceClient } from "@/lib/supabase/server";

async function assertOwnsClass(teacherId: string, classId: string) {
  const supabase = createServiceClient();
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;
  if (!cls) throw new Error("Class not found.");
}

async function toImageBuffer(file: File): Promise<{ bytes: Buffer; contentType: string }> {
  const arrayBuffer = await file.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), contentType: file.type || "application/octet-stream" };
}

// Creates the paper row, extracts questions from the uploaded files via AI,
// and saves the extraction as the paper's initial (still-draft) question
// set — the teacher reviews/edits on the next page before finalizing.
export async function createPaperAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const classId = formData.get("classId");
  const title = formData.get("title");
  if (typeof classId !== "string" || typeof title !== "string" || title.trim().length < 2) {
    throw new Error("Missing classId or title (must be at least 2 characters).");
  }
  await assertOwnsClass(profile.id, classId);

  const questionPaperFiles = formData
    .getAll("questionPaperFiles")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const markschemeFiles = formData
    .getAll("markschemeFiles")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (questionPaperFiles.length === 0) throw new Error("Upload at least one question paper file.");
  if (markschemeFiles.length === 0) throw new Error("Upload at least one markscheme file.");

  const [questionPaperImages, markschemeImages] = await Promise.all([
    Promise.all(questionPaperFiles.map(toImageBuffer)),
    Promise.all(markschemeFiles.map(toImageBuffer)),
  ]);

  const paperId = await createPaper({ teacherId: profile.id, classId, title: title.trim() });
  const extracted = await extractPaperQuestions({ questionPaperImages, markschemeImages });
  await replacePaperQuestions(paperId, extracted);

  redirect(`/teacher/papers/${paperId}/review`);
}

type ReviewedQuestion = {
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
};

function isValidReviewedQuestion(q: unknown): q is ReviewedQuestion {
  if (typeof q !== "object" || q === null) return false;
  const r = q as Record<string, unknown>;
  return (
    typeof r.questionNumber === "number" &&
    typeof r.prompt === "string" && r.prompt.trim().length > 0 &&
    typeof r.maxMarks === "number" && r.maxMarks > 0 &&
    Array.isArray(r.markscheme) && r.markscheme.length > 0 &&
    r.markscheme.every((m) => typeof m === "object" && m !== null && typeof (m as any).point === "string")
  );
}

// Saves the teacher's edits from the review screen and marks the paper
// ready. formData carries the full edited question set as one JSON blob
// (same "hidden JSON field" pattern as
// app/actions/lessons.ts's saveSubtopicLessonAction) rather than N separate
// form fields per question, since the count/shape is dynamic.
export async function savePaperReviewAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  const questionsJson = formData.get("questions");
  if (typeof paperId !== "string" || typeof questionsJson !== "string") {
    throw new Error("Missing paperId or questions.");
  }

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  let questions: unknown;
  try {
    questions = JSON.parse(questionsJson);
  } catch {
    throw new Error("The reviewed questions contain invalid data — please retry.");
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("A paper needs at least one question.");
  }
  if (!questions.every(isValidReviewedQuestion)) {
    throw new Error(
      "Every question needs a number, prompt, positive max marks, and at least one markscheme point."
    );
  }

  await replacePaperQuestions(paperId, questions);
  await markPaperReady(paperId);
  revalidatePath("/teacher/papers");
  redirect(`/teacher/papers/${paperId}`);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

### Task 5: UI — `/teacher/papers` list + create page

**Files:**
- Create: `app/teacher/papers/page.tsx`
- Modify: `app/teacher/layout.tsx`

**Interfaces:**
- Consumes: `listPapersForTeacher` from `@/lib/supabase/papers` (Task 2); `listClassesByTeacher` from `@/lib/supabase/classes` (existing); `createPaperAction` from `@/app/actions/papers` (Task 4); `Button` from `@/components/button`

- [ ] **Step 1: Add "Papers" to the teacher nav**

Current `app/teacher/layout.tsx` (from this session's earlier work):

```ts
const NAV_ITEMS = [
  { href: "/teacher/subjects", label: "Subjects" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/mark", label: "Mark Paper" },
  { href: "/teacher/settings", label: "AI Settings" },
];
```

Replace with:

```ts
const NAV_ITEMS = [
  { href: "/teacher/subjects", label: "Subjects" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/papers", label: "Papers" },
  { href: "/teacher/mark", label: "Mark Paper" },
  { href: "/teacher/settings", label: "AI Settings" },
];
```

- [ ] **Step 2: Write the list/create page**

```tsx
// app/teacher/papers/page.tsx
import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { listPapersForTeacher } from "@/lib/supabase/papers";
import { listClassesByTeacher } from "@/lib/supabase/classes";
import { createPaperAction } from "@/app/actions/papers";
import { Button } from "@/components/button";

export default async function TeacherPapersPage() {
  const { profile } = await requireRole("teacher");
  const [papers, classes] = await Promise.all([
    listPapersForTeacher(profile.id),
    listClassesByTeacher(profile.id),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Papers
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload a question paper and its markscheme — AI extracts a structured,
          markable question set you review before it&apos;s used.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="text-sm text-muted">
          Create a class first (on the Classes tab) before setting up a paper.
        </p>
      ) : (
        <form
          action={createPaperAction}
          encType="multipart/form-data"
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="classId" className="text-sm font-medium text-foreground">
              Class
            </label>
            <select
              id="classId"
              name="classId"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-sm font-medium text-foreground">
              Paper title
            </label>
            <input
              id="title"
              name="title"
              placeholder="e.g. Mock Exam — Paper 1"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="questionPaperFiles" className="text-sm font-medium text-foreground">
              Question paper (PDF or image, one or more files)
            </label>
            <input
              id="questionPaperFiles"
              name="questionPaperFiles"
              type="file"
              accept=".pdf,image/*"
              multiple
              className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="markschemeFiles" className="text-sm font-medium text-foreground">
              Markscheme (PDF or image, one or more files)
            </label>
            <input
              id="markschemeFiles"
              name="markschemeFiles"
              type="file"
              accept=".pdf,image/*"
              multiple
              className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
          </div>

          <Button type="submit" size="compact" className="self-start">
            Upload &amp; extract questions
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {papers.length === 0 ? (
          <p className="text-sm text-muted">No papers yet — create one above.</p>
        ) : (
          papers.map((p) => (
            <Link
              key={p.id}
              href={p.status === "ready" ? `/teacher/papers/${p.id}` : `/teacher/papers/${p.id}/review`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 hover:border-primary"
            >
              <p className="text-sm font-medium text-foreground">{p.title}</p>
              <span
                className={`rounded-full border px-3 py-1 text-xs ${
                  p.status === "ready"
                    ? "border-success/40 text-success"
                    : "border-highlight/40 text-highlight"
                }`}
              >
                {p.status === "ready" ? "Ready" : "Needs review"}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
```

Note: `encType="multipart/form-data"` is set explicitly even though this codebase's other file-upload forms (e.g. `app/actions/topic-documents.ts`'s consuming form) don't always set it explicitly — Next.js Server Actions handle multipart forms automatically either way, but since this form has two separate `multiple` file inputs plus text fields, being explicit avoids any ambiguity.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

### Task 6: UI — review screen (client component + page)

**Files:**
- Create: `app/teacher/papers/[paperId]/review/review-form.tsx`
- Create: `app/teacher/papers/[paperId]/review/page.tsx`

**Interfaces:**
- Consumes: `getPaper`, `getPaperQuestions` from `@/lib/supabase/papers` (Task 2); `savePaperReviewAction` from `@/app/actions/papers` (Task 4); `PaperQuestion` type from `@/lib/supabase/papers`

- [ ] **Step 1: Write the client component**

Dynamic per-question, per-markscheme-point editing needs client-side state (add/remove a markscheme point, edit any field) serialized into one hidden JSON field on submit — same shape of problem as `components/subtopic-lesson-editor.tsx` (dynamic nested content edited client-side, submitted as one JSON blob to a Server Action).

```tsx
// app/teacher/papers/[paperId]/review/review-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { savePaperReviewAction } from "@/app/actions/papers";
import type { PaperQuestion } from "@/lib/supabase/papers";

type EditableQuestion = {
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
};

export function PaperReviewForm({
  paperId,
  initialQuestions,
}: {
  paperId: string;
  initialQuestions: PaperQuestion[];
}) {
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    initialQuestions.map((q) => ({
      questionNumber: q.questionNumber,
      prompt: q.prompt,
      maxMarks: q.maxMarks,
      markscheme: q.markscheme.map((m) => ({ point: m.point })),
    }))
  );

  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updatePoint(qIndex: number, pIndex: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, markscheme: q.markscheme.map((m, j) => (j === pIndex ? { point: value } : m)) }
          : q
      )
    );
  }

  function addPoint(qIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qIndex ? { ...q, markscheme: [...q.markscheme, { point: "" }] } : q))
    );
  }

  function removePoint(qIndex: number, pIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, markscheme: q.markscheme.filter((_, j) => j !== pIndex) } : q
      )
    );
  }

  return (
    <form action={savePaperReviewAction} className="flex flex-col gap-6">
      <input type="hidden" name="paperId" value={paperId} />
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      {questions.map((q, qIndex) => (
        <div key={qIndex} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Question #
              <input
                type="number"
                value={q.questionNumber}
                onChange={(e) => updateQuestion(qIndex, { questionNumber: Number(e.target.value) })}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Max marks
              <input
                type="number"
                value={q.maxMarks}
                onChange={(e) => updateQuestion(qIndex, { maxMarks: Number(e.target.value) })}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Prompt
            <textarea
              value={q.prompt}
              onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
              rows={3}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Markscheme points</span>
            {q.markscheme.map((m, pIndex) => (
              <div key={pIndex} className="flex items-center gap-2">
                <input
                  value={m.point}
                  onChange={(e) => updatePoint(qIndex, pIndex, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
                <button
                  type="button"
                  onClick={() => removePoint(qIndex, pIndex)}
                  className="shrink-0 text-xs text-error hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addPoint(qIndex)}
              className="self-start text-xs text-primary hover:underline"
            >
              + Add point
            </button>
          </div>
        </div>
      ))}

      <Button type="submit" size="compact" className="self-start">
        Save &amp; finalize paper
      </Button>
    </form>
  );
}
```

Note: the hidden `questions` field's `value` is recomputed on every render from React state, so it always reflects the latest edits at submit time — no separate "sync to hidden field on submit" step needed.

- [ ] **Step 2: Write the page**

```tsx
// app/teacher/papers/[paperId]/review/page.tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions } from "@/lib/supabase/papers";
import { PaperReviewForm } from "./review-form";

export default async function PaperReviewPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();

  const questions = await getPaperQuestions(paperId);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Review: {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          AI extracted {questions.length} question{questions.length === 1 ? "" : "s"} — check the
          prompt, marks, and markscheme for each before finalizing. Nothing is markable until you save.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-error">
          No questions were extracted. Go back to Papers and try uploading clearer files.
        </p>
      ) : (
        <PaperReviewForm paperId={paperId} initialQuestions={questions} />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

### Task 7: UI — paper detail page

**Files:**
- Create: `app/teacher/papers/[paperId]/page.tsx`

**Interfaces:**
- Consumes: `getPaper`, `getPaperQuestions` from `@/lib/supabase/papers` (Task 2)

- [ ] **Step 1: Write the page**

Read-only for now — this is the shell that the next stage (roster building) extends with real functionality; for this stage it just confirms the paper's finalized question set.

```tsx
// app/teacher/papers/[paperId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions } from "@/lib/supabase/papers";

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();
  if (paper.status === "draft") redirect(`/teacher/papers/${paperId}/review`);

  const questions = await getPaperQuestions(paperId);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {questions.length} question{questions.length === 1 ? "" : "s"}, ready to mark.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Question {q.questionNumber} · {q.maxMarks} {q.maxMarks === 1 ? "mark" : "marks"}
            </p>
            <p className="mt-1 text-sm text-foreground">{q.prompt}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: End-to-end manual verification**

Using the running dev server preview and the real teacher/class from this session's prior verification work:
1. Visit `/teacher/papers`, confirm the "Papers" nav item and the create form render.
2. Submit a real small test paper + markscheme (the same pair used in Task 3's manual AI verification, if still available). Confirm redirect to the review screen with extracted questions populated.
3. Edit a field (e.g. tweak a markscheme point's wording), add a point, remove a point, then save. Confirm redirect to the detail page showing the edited (not original) content, and that `papers.status` is now `'ready'` (check via the Supabase MCP `execute_sql` tool).
4. Confirm a different teacher (or a student/admin role) visiting `/teacher/papers/<id>/review` or `/teacher/papers/<id>` for this paper gets a 404, not the content.
5. Clean up any test paper/questions rows created during this verification via `execute_sql`, matching this session's established cleanup discipline for live-data verification.

---

## Self-review notes

- **Spec coverage:** all three spec goals (upload + extract, review/edit, finalize into the exact shape `markAnswer`/`markAnswerFromImages` already consume) map to Tasks 1-7. The spec's deferred `extractViaGemini`/`extractViaHackClub` "copy the pattern" note is fully resolved here with real, complete code (Task 3) — no plan step defers to "similar to marking.ts" without showing the actual code.
- **Type consistency:** `ExtractedPaperQuestion` (Task 3) and `PaperQuestionInput` (Task 2) have identical shape (`questionNumber, prompt, maxMarks, markscheme: {point}[]`) and `createPaperAction` (Task 4) passes one directly where the other is expected — verified consistent. `ReviewedQuestion` (Task 4) matches the same shape again. `PaperReviewForm`'s `EditableQuestion` (Task 6) also matches.
- **No placeholders:** every step has complete, real code; the one place manual (not automated) verification is used (Task 3 Step 3, Task 7 Step 3) is explicitly justified in Global Constraints (real AI vision calls and real live-DB checks aren't meaningfully mockable in this repo's current test setup) rather than skipped silently.
