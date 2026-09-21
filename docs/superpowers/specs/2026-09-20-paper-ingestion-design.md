# Paper ingestion — question paper + markscheme → structured questions (sub-project 1 of 4)

## Context

This is the first of four sequential sub-stages of the AI paper-marking pipeline requested together: (1) paper ingestion (this spec), (2) roster building (reference codes for platform students + custom students), (3) bulk answer upload + AI splitting + marking, (4) feedback delivery via shareable links. Each stage is independently shippable and builds on the previous one's data. This is the third and final feature area from the original three-part request (subject copy → subtopic assignment → this), both already shipped this session.

## Problem

A teacher who wants to run a paper-marking workflow today has no way to get a physical/PDF exam paper's questions and markscheme into a storable, machine-markable format. The existing `questions` table is topic-scoped (every row requires a `topic_id`) and designed for the self-study practice/lesson flow — a mock exam paper isn't tied to a single topic, may span many topics or an entire subject, and has its own lifecycle (draft while being set up, ready once reviewed, eventually marked against real student submissions).

## Goals

1. A teacher picks a class, uploads a question paper (PDF/image, one or more files) and its markscheme (PDF/image, one or more files) separately, and gets back a structured, storable, per-question breakdown: question number, prompt text, max marks, and markscheme points.
2. The teacher reviews and can hand-edit any extracted question before it's finalized — AI misreads (especially of handwritten or densely-formatted markschemes) are expected, not exceptional, and this feeds directly into automated marking downstream.
3. A finalized ("ready") paper's questions are stored in the exact shape the existing AI-marking code (`lib/ai/marking.ts`'s `markAnswer`/`markAnswerFromImages`) already expects (`{prompt, markscheme: {point}[], maxMarks}`), so stage 3 (marking) needs zero new marking logic — only new orchestration around calling that existing code once per question per student.

## Non-goals (deferred to later stages/specs)

- Roster building, reference codes, custom students — stage 2.
- Uploading/marking student answer scripts — stage 3.
- Sharing feedback — stage 4.
- Multi-class reuse of one paper (a paper belongs to exactly one class, decided at creation, per the design conversation) — if this turns out to matter later, it's a small follow-up (drop the FK, add a join table), not a reason to complicate this spec now.

## Design

### Data model

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
  markscheme jsonb NOT NULL, -- array of { point: string }
  image_url text,            -- set if the question includes a diagram/figure worth showing back to the teacher on review; not re-extracted from the uploaded files automatically (see Non-goals-adjacent note below)
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_questions ENABLE ROW LEVEL SECURITY;
-- No policies — this app's authorization model is entirely in the Server
-- Action layer via the service-role client (see lib/appwrite/session.ts's
-- requireRole/requireOwnerOrAdmin pattern), matching every other table.
-- RLS is enabled with zero policies purely to keep the security-audit
-- posture consistent (deny-all for anon/authenticated, as fixed earlier
-- this session for the 7 tables that had RLS off entirely).
```

`image_url` is included in the schema now (since adding a column later is more disruptive than leaving one unused) but this spec does not implement diagram extraction — the AI extraction step in this spec produces text-only questions. If a question paper has a diagram, the `prompt` text will describe it as best the AI can from context, and `image_url` stays null. Real diagram capture is a reasonable future enhancement, explicitly out of scope here.

### New file: `lib/supabase/papers.ts`

Following this codebase's established per-concern-file pattern (`lib/supabase/lessons.ts`, `lib/supabase/questions.ts`, etc.):

```ts
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

export async function replacePaperQuestions(
  paperId: string,
  questions: PaperQuestionInput[]
): Promise<void> {
  const supabase = createServiceClient();
  // Replace-all semantics: the review screen (Step 3 below) always submits
  // the full edited set, so clearing first keeps this idempotent regardless
  // of how many times a teacher revisits the review screen before finalizing.
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

### New file: `lib/ai/paper-extraction.ts`

Reuses the exact vision-call pattern already established in `lib/ai/marking.ts`'s `markAnswerFromImages`/`markViaGemini`/`markViaHackClub` (provider selection: prefer Hack Club if `AI_PROVIDER=hackclub` and its key is set, else Gemini if its key is set, else Hack Club if its key is set, else throw) — this is a proven, working pattern in this codebase for multi-image vision calls, not a new one being invented:

```ts
import "server-only";

export type ExtractedPaperQuestion = {
  questionNumber: number;
  prompt: string;
  maxMarks: number;
  markscheme: { point: string }[];
};

export async function extractPaperQuestions(input: {
  questionPaperImages: { bytes: Buffer; contentType: string }[];
  markschemeImages: { bytes: Buffer; contentType: string }[];
}): Promise<ExtractedPaperQuestion[]> {
  const preferHackClub = process.env.AI_PROVIDER === "hackclub";
  const hackclubKey = process.env.HACKCLUB_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (preferHackClub && hackclubKey) return extractViaHackClub(input, hackclubKey);
  if (geminiKey) return extractViaGemini(input, geminiKey);
  if (hackclubKey) return extractViaHackClub(input, hackclubKey);
  throw new Error("Paper extraction requires a vision-capable provider (Gemini or Hack Club) key.");
}

const EXTRACTION_PROMPT = `You are given a question paper (one set of images) and its markscheme (a second set of images). Match questions across both documents by question number.

For each question, produce:
- questionNumber: the question number as printed (integer)
- prompt: the full question text, transcribed exactly, including any sub-parts (a), (b), etc. as part of the same prompt if the markscheme marks them as one question
- maxMarks: the total marks available for the question, from the markscheme (often shown in brackets like "[3 marks]" on the paper, or as a total in the markscheme)
- markscheme: an array of individual marking points a student's answer should be checked against, each as { "point": "..." } — one point per distinct fact/step that earns a mark, phrased so a marker (human or AI) can check "does the answer include this?"

Return every question found on the paper, in order. If a question has no clear markscheme match, still include it with your best-effort markscheme derived from question context.`;

// Implementation of extractViaGemini/extractViaHackClub follows the same
// structure as markViaGemini/markViaHackClub in lib/ai/marking.ts: build a
// multi-part request with EXTRACTION_PROMPT as text plus each image as
// inlineData/image_url, request a JSON response matching
// { questions: ExtractedPaperQuestion[] }, parse and return result.questions.
// The implementer copies that file's exact provider-call mechanics
// (endpoint, request shape, response parsing) — only the prompt and
// response schema differ, not the transport code.
```

### New file: `app/actions/papers.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { extractPaperQuestions } from "@/lib/ai/paper-extraction";
import { createPaper, replacePaperQuestions, markPaperReady } from "@/lib/supabase/papers";
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

  const questionPaperFiles = formData.getAll("questionPaperFiles").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  const markschemeFiles = formData.getAll("markschemeFiles").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
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

// PDF pages are sent to the vision model as-is (Gemini and Hack Club's
// underlying vision models both accept application/pdf directly — no
// separate PDF-to-image rasterization step needed, unlike
// lib/extract-text.ts's text-extraction path which is a different use case).
async function toImageBuffer(file: File): Promise<{ bytes: Buffer; contentType: string }> {
  const arrayBuffer = await file.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), contentType: file.type || "application/octet-stream" };
}

// Saves the teacher's edits from the review screen (Step 3) and marks the
// paper ready. formData carries the full edited question set as one JSON
// blob (same "hidden JSON field" pattern as
// app/actions/lessons.ts's saveSubtopicLessonAction) rather than N
// separate form fields per question, since the count/shape is dynamic.
export async function savePaperReviewAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  const questionsJson = formData.get("questions");
  if (typeof paperId !== "string" || typeof questionsJson !== "string") {
    throw new Error("Missing paperId or questions.");
  }

  const { getPaper } = await import("@/lib/supabase/papers");
  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  let questions;
  try {
    questions = JSON.parse(questionsJson);
  } catch {
    throw new Error("The reviewed questions contain invalid data — please retry.");
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("A paper needs at least one question.");
  }
  for (const q of questions) {
    if (
      typeof q.questionNumber !== "number" ||
      typeof q.prompt !== "string" || q.prompt.trim().length === 0 ||
      typeof q.maxMarks !== "number" || q.maxMarks <= 0 ||
      !Array.isArray(q.markscheme) || q.markscheme.length === 0
    ) {
      throw new Error("Every question needs a number, prompt, positive max marks, and at least one markscheme point.");
    }
  }

  await replacePaperQuestions(paperId, questions);
  await markPaperReady(paperId);
  revalidatePath("/teacher/papers");
  redirect(`/teacher/papers/${paperId}`);
}
```

Ownership is checked directly against `paper.teacherId === profile.id` (not `requireOwnerOrAdmin`, which is subject-specific) — a simple equality check matches this codebase's existing pattern for other teacher-owned, non-subject entities (e.g. `assertOwnsClass` in `app/actions/assign.ts`).

### UI

**New route `/teacher/papers`** (list page, mirrors `/teacher/classes`'s structure): lists the teacher's papers with status badges (draft/ready), a "New paper" form (class picker + title + the two file-upload inputs + submit to `createPaperAction`).

**New route `/teacher/papers/[paperId]/review`**: the post-extraction review screen. Server Component loads `getPaperQuestions(paperId)`, renders each question in an editable card (question number, prompt textarea, max marks number input, markscheme points as a dynamic list of text inputs) inside one form. Given the dynamic per-question/per-point structure, this needs a small **Client Component** (`app/teacher/papers/[paperId]/review/review-form.tsx`) managing local edit state and serializing to the hidden JSON field on submit — this is the same shape of problem `components/subtopic-lesson-editor.tsx` already solves (dynamic nested content, edited client-side, submitted as one JSON blob to a Server Action), so it follows that file's established pattern rather than inventing a new one.

**New route `/teacher/papers/[paperId]`**: the finalized paper's detail view (read-only question list) — this is also where stage 2 (roster building) will add its UI, so this spec creates the page shell and the question list, and stage 2's spec extends it.

### Testing

- `extractPaperQuestions` given a known simple 2-question paper + markscheme image pair returns exactly 2 questions with plausible `questionNumber`/`maxMarks`/non-empty `markscheme` — this is the one genuinely hard-to-unit-test piece (real AI vision call); verify manually against a real small test paper during implementation rather than mocking the model's output, since a mocked "AI extracted this" test would just be asserting the mock.
- `createPaperAction` requires teacher role and class ownership; rejects a title under 2 characters; rejects zero question-paper or zero markscheme files.
- `replacePaperQuestions` is idempotent — calling it twice with different question sets leaves only the second set (delete-then-insert, verified via row count).
- `savePaperReviewAction` rejects malformed JSON, an empty question array, and a question missing any required field (number/prompt/maxMarks/markscheme) with a clear message; on success, the paper's `status` becomes `'ready'` and `getPaperQuestions` reflects the edited (not original AI-extracted) content.
