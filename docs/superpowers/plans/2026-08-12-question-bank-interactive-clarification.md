# Question Bank & Interactive Clarification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-generate 10 GCSE practice questions per lesson (tagged to lesson sections with weighted distribution), serve them adaptively with a 4-correct mastery exit, show Brilliant-style interactive clarification cards after any wrong quick checks, add optional AI images to questions, and give teachers a review/verify/edit UI for the question bank.

**Architecture:** Extend the `questions` table with `section_index`, `bank_position`, `verified`, and `image` columns. Generate all 10 questions in one batch AI call using lesson section context. Track practice sessions in two new tables (`question_sessions`, `question_session_attempts`). Add four interactive React components (`StepReveal`, `FillGap`, `SortOrder`, `MatchConnect`). Extend `lesson-player.tsx` with a `clarify` phase that fires after any wrong quick checks.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), Appwrite Storage, React, Vitest, existing `lib/ai/client.ts` `chatJson`/`ProviderConfig` pattern.

## Global Constraints

- All AI calls use `chatJson()` from `lib/ai/client.ts` — never call provider SDKs directly from feature code
- All new `lib/ai/` and `lib/supabase/` files must have `import "server-only"` as the first line
- Follow `ProviderConfig` + `resolveProviderConfig()` for all AI functions that accept a config
- AI text fields: plain prose, no markdown symbols (`**`, `*`, `#`), math as LaTeX `$...$` inline or `$$...$$` standalone
- Images use `generateLessonImage(prompt, id)` from `lib/ai/images.ts` which returns `string | null` (never throws)
- File storage: `uploadFile({ bytes, filename, contentType })` returns a fileId; `getFileUrl(fileId)` returns the URL — both from `lib/appwrite/storage.ts`
- Tests: Vitest, `describe`/`it`/`expect` — match the pattern in `lib/question-marking.test.ts`
- No new npm dependencies

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260812_question_bank.sql` | Create | DB schema additions |
| `lib/ai/question-bank.ts` | Create | Batch question generation + `distributeQuestions` |
| `lib/ai/question-bank.test.ts` | Create | Unit tests for `distributeQuestions` |
| `lib/ai/questions.ts` | Modify | Add `image` field to `GeneratedQuestion` + schema |
| `lib/supabase/question-bank.ts` | Create | DB layer for bank + sessions |
| `lib/supabase/questions.ts` | Modify | Update `Question` type + select strings |
| `lib/content-pipeline.ts` | Modify | Call `generateQuestionBank` instead of single question |
| `lib/question-finalize.ts` | Create | Generate + store question images |
| `components/interactive/step-reveal.tsx` | Create | Interactive component |
| `components/interactive/fill-gap.tsx` | Create | Interactive component |
| `components/interactive/sort-order.tsx` | Create | Interactive component |
| `components/interactive/match-connect.tsx` | Create | Interactive component |
| `components/interactive/index.ts` | Create | Barrel export |
| `lib/ai/clarification.ts` | Create | AI generation of interactive clarification content |
| `app/actions/clarification.ts` | Create | Server action wrapper for clarification generation |
| `app/learn/[topicId]/clarification-player.tsx` | Create | "Let's revisit" UI |
| `app/learn/[topicId]/lesson-player.tsx` | Modify | Add `clarify` phase + `wrongSections` tracking |
| `app/actions/practice.ts` | Modify | Add bank-based session actions |
| `app/practice/[topicId]/page.tsx` | Modify | Session-aware question serving |
| `app/practice/[topicId]/answer-form.tsx` | Modify | Carry session state, wire new actions |
| `app/admin/subjects/page.tsx` | Modify | Question bank review panel |
| `app/actions/subjects.ts` | Modify | `verifyQuestionAction`, `updateQuestionAction`, `regenerateQuestionBankAction` |

---

## Task 1: DB Schema Migration

**Files:**
- Create: `supabase/migrations/20260812_question_bank.sql`

**Interfaces:**
- Produces: `questions.section_index`, `questions.bank_position`, `questions.verified`, `questions.image` columns; `question_sessions` table; `question_session_attempts` table

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260812_question_bank.sql

-- Extend questions with bank metadata and optional image
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS section_index INTEGER,
  ADD COLUMN IF NOT EXISTS bank_position INTEGER,
  ADD COLUMN IF NOT EXISTS verified    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image       JSONB;

-- Speed up ordered bank fetches
CREATE INDEX IF NOT EXISTS idx_questions_topic_bank
  ON questions (topic_id, bank_position)
  WHERE bank_position IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_subtopic_bank
  ON questions (subtopic_id, bank_position)
  WHERE bank_position IS NOT NULL AND subtopic_id IS NOT NULL;

-- Practice session tracking
CREATE TABLE IF NOT EXISTS question_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  topic_id     UUID        REFERENCES topics(id)              ON DELETE CASCADE,
  subtopic_id  UUID        REFERENCES subtopics(id)           ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  mastery_exit BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS question_session_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES question_sessions(id) ON DELETE CASCADE,
  question_id  UUID        NOT NULL REFERENCES questions(id)          ON DELETE CASCADE,
  correct      BOOLEAN     NOT NULL,
  is_retry     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE question_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_session_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sessions" ON question_sessions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "own_attempts" ON question_session_attempts
  FOR ALL USING (
    session_id IN (SELECT id FROM question_sessions WHERE student_id = auth.uid())
  );

-- Teachers/admins can read all sessions for analytics
CREATE POLICY "staff_read_sessions" ON question_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

CREATE POLICY "staff_read_attempts" ON question_session_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );
```

- [ ] **Step 2: Apply migration**

Apply via the Supabase dashboard SQL editor (paste and run), or if the CLI is configured:

```bash
npx supabase db push
```

- [ ] **Step 3: Verify**

In the Supabase Table Editor confirm `questions` has the four new columns and that `question_sessions` + `question_session_attempts` appear in the table list.

---

## Task 2: Question Bank AI Generation

**Files:**
- Create: `lib/ai/question-bank.ts`
- Create: `lib/ai/question-bank.test.ts`
- Modify: `lib/ai/questions.ts`

**Interfaces:**
- Consumes: `chatJson`, `ProviderConfig` from `lib/ai/client.ts`; `MarkPoint`, `QuestionFormat` types from `lib/ai/questions.ts`
- Produces:
  - `distributeQuestions(sectionCount: number, total: number): number[]`
  - `BankedQuestion` type (extends `GeneratedQuestion` with `sectionIndex` + `bankPosition`)
  - `generateQuestionBank(topicName, subjectName, sections, customInstructions?, config?): Promise<BankedQuestion[]>`
  - `GeneratedQuestion.image` optional field added to `lib/ai/questions.ts`

- [ ] **Step 1: Add `image` to `GeneratedQuestion` in `lib/ai/questions.ts`**

In the type, add the optional field after `format`:

```typescript
export type GeneratedQuestion = {
  prompt: string;
  markscheme: MarkPoint[];
  maxMarks: number;
  modelAnswer: string;
  format?: QuestionFormat | null;
  image?: { prompt: string; alt: string; url?: string } | null; // NEW
};
```

In `SCHEMA` (the const object, under `properties`), add alongside the existing `format` property:

```typescript
image: {
  type: "object",
  properties: {
    prompt: { type: "string" },
    alt:    { type: "string" },
  },
  required: ["prompt", "alt"],
},
```

Do NOT add `image` to the top-level `required` array — it is optional.

- [ ] **Step 2: Write the failing test**

Create `lib/ai/question-bank.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { distributeQuestions } from "./question-bank";

describe("distributeQuestions", () => {
  it("3 sections → [3, 3, 4]", () => {
    expect(distributeQuestions(3, 10)).toEqual([3, 3, 4]);
  });
  it("4 sections → [2, 2, 3, 3]", () => {
    expect(distributeQuestions(4, 10)).toEqual([2, 2, 3, 3]);
  });
  it("5 sections → [2, 2, 2, 2, 2]", () => {
    expect(distributeQuestions(5, 10)).toEqual([2, 2, 2, 2, 2]);
  });
  it("2 sections → [5, 5]", () => {
    expect(distributeQuestions(2, 10)).toEqual([5, 5]);
  });
  it("1 section → [10]", () => {
    expect(distributeQuestions(1, 10)).toEqual([10]);
  });
});
```

- [ ] **Step 3: Run — verify it fails**

```bash
npx vitest run lib/ai/question-bank.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 4: Create `lib/ai/question-bank.ts`**

```typescript
import "server-only";
import { chatJson, type ProviderConfig } from "./client";
import type { MarkPoint, QuestionFormat } from "./questions";

export type BankedQuestion = {
  sectionIndex: number;
  bankPosition: number;
  prompt: string;
  markscheme: MarkPoint[];
  maxMarks: number;
  modelAnswer: string;
  format?: QuestionFormat | null;
  image?: { prompt: string; alt: string } | null;
};

/**
 * Distributes `total` questions across `sectionCount` sections.
 * Remainder goes to the last sections (hardest material gets more practice).
 * distributeQuestions(3, 10) → [3, 3, 4]
 */
export function distributeQuestions(sectionCount: number, total: number): number[] {
  const base = Math.floor(total / sectionCount);
  const remainder = total % sectionCount;
  return Array.from({ length: sectionCount }, (_, i) =>
    i >= sectionCount - remainder ? base + 1 : base
  );
}

const BANK_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionIndex: { type: "integer" },
          prompt:       { type: "string" },
          maxMarks:     { type: "integer" },
          markscheme: {
            type: "array",
            items: {
              type: "object",
              properties: { point: { type: "string" } },
              required: ["point"],
            },
          },
          modelAnswer: { type: "string" },
          image: {
            type: "object",
            properties: {
              prompt: { type: "string" },
              alt:    { type: "string" },
            },
            required: ["prompt", "alt"],
          },
          format: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "multiple-choice", "short-answer", "calculation",
                  "matching", "structured", "data-analysis", "practical", "extended",
                ],
              },
              options:        { type: "array", items: { type: "string" } },
              correctIndexes: { type: "array", items: { type: "integer" } },
              accepted:       { type: "array", items: { type: "string" } },
              answer:         { type: "string" },
              unit:           { type: "string" },
              pairs: {
                type: "array",
                items: {
                  type: "object",
                  properties: { left: { type: "string" }, right: { type: "string" } },
                  required: ["left", "right"],
                },
              },
              parts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label:      { type: "string" },
                    prompt:     { type: "string" },
                    marks:      { type: "integer" },
                    markscheme: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { point: { type: "string" } },
                        required: ["point"],
                      },
                    },
                  },
                  required: ["label", "prompt", "marks", "markscheme"],
                },
              },
              table: {
                type: "object",
                properties: {
                  headers: { type: "array", items: { type: "string" } },
                  rows:    { type: "array", items: { type: "array", items: { type: "string" } } },
                },
                required: ["headers", "rows"],
              },
            },
            required: ["type", "options", "correctIndexes", "accepted", "answer", "pairs", "parts", "table"],
          },
        },
        required: ["sectionIndex", "prompt", "maxMarks", "markscheme", "modelAnswer", "format"],
      },
    },
  },
  required: ["questions"],
};

export async function generateQuestionBank(
  topicName: string,
  subjectName: string,
  sections: { heading: string; explanation: string }[],
  customInstructions?: string,
  config?: ProviderConfig
): Promise<BankedQuestion[]> {
  const distribution = distributeQuestions(sections.length, 10);

  const sectionList = sections
    .map((s, i) => `Section ${i} — "${s.heading}": ${s.explanation}`)
    .join("\n");

  const distributionGuide = distribution
    .map((n, i) => `Section ${i} ("${sections[i].heading}"): ${n} question${n !== 1 ? "s" : ""}`)
    .join(", ");

  const instructionNote = customInstructions
    ? `\n\nAdmin instructions — follow these: ${customInstructions}`
    : "";

  const formatGuide =
    `For each question pick the format (format.type) that best fits:\n` +
    `- "multiple-choice": options (4-6) + correctIndexes.\n` +
    `- "short-answer": canonical answer + synonyms in "accepted".\n` +
    `- "calculation": numeric final answer in "answer", unit in "unit", working steps in markscheme.\n` +
    `- "matching": 3-5 left/right pairs.\n` +
    `- "structured": parts a/b/c each with their own prompt, marks, markscheme.\n` +
    `- "data-analysis": small table (headers + rows of strings), ask student to interpret.\n` +
    `- "practical": variables, method, risk — markscheme covers those points.\n` +
    `- "extended": 4-6 mark continuous-prose answer.\n` +
    `maxMarks must equal total markscheme points. Vary formats across the bank — do not reuse the same type for every question. ` +
    `All format fields are required even when unused — empty [] for lists, "" for strings, {"headers":[],"rows":[]} for table.\n` +
    `Write plain prose, no markdown symbols. Math as $...$ (inline LaTeX) or $$...$$ (standalone).`;

  const imageGuide =
    `\n\nOptionally include an "image" on a question when a diagram, graph, photograph, or ` +
    `data chart would make it a more realistic GCSE exam question — like on a real paper. ` +
    `Write a descriptive "prompt" for an image generator and a screen-reader "alt" text. ` +
    `Omit the image field entirely when no visual adds genuine value. Most questions should have no image.`;

  const result = await chatJson<{ questions: BankedQuestion[] }>(
    `Generate a bank of exactly 10 GCSE exam-style questions on "${topicName}" ` +
      `(subject: "${subjectName}") in the style and difficulty of a real UK GCSE paper.\n\n` +
      `The lesson has ${sections.length} sections:\n${sectionList}\n\n` +
      `Distribute the 10 questions across sections as follows: ${distributionGuide}. ` +
      `Each question MUST include "sectionIndex" (0-based integer) matching its section above. ` +
      `Questions should be ordered by sectionIndex (section 0 first, section N last).\n\n` +
      `${formatGuide}${imageGuide}${instructionNote}`,
    BANK_SCHEMA,
    config
  );

  // Sort by sectionIndex, then assign sequential bankPosition
  const sorted = [...result.questions].sort((a, b) => a.sectionIndex - b.sectionIndex);
  return sorted.map((q, i) => ({ ...q, bankPosition: i }));
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run lib/ai/question-bank.test.ts
```

Expected: 5/5 pass.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/question-bank.ts lib/ai/question-bank.test.ts lib/ai/questions.ts
git commit -m "feat: question bank AI generation with section tagging and image support"
```

---

## Task 3: Question Bank DB Layer

**Files:**
- Create: `lib/supabase/question-bank.ts`
- Modify: `lib/supabase/questions.ts`

**Interfaces:**
- Consumes: `BankedQuestion` from `lib/ai/question-bank.ts`; `createServiceClient` from `lib/supabase/server.ts`; `QuestionFormat` from `lib/ai/questions.ts`
- Produces:
  - `createQuestionBank(topicId, questions, classId?): Promise<void>`
  - `getQuestionBank(topicId, classId?): Promise<Question[]>`
  - `createQuestionBankForSubtopic(topicId, subtopicId, questions): Promise<void>`
  - `getQuestionBankForSubtopic(subtopicId): Promise<Question[]>`
  - `verifyBankQuestion(questionId): Promise<void>`
  - `updateBankQuestion(questionId, patch): Promise<void>`
  - `createQuestionSession(studentId, topicId?, subtopicId?): Promise<string>`
  - `recordSessionAttempt(sessionId, questionId, correct, isRetry): Promise<void>`
  - `completeSession(sessionId, masteryExit): Promise<void>`

- [ ] **Step 1: Update `Question` type in `lib/supabase/questions.ts`**

Add four new fields to the existing `Question` type:

```typescript
export type Question = {
  id: string;
  topic_id: string;
  prompt: string;
  markscheme: { point: string }[];
  max_marks: number;
  model_answer: string;
  format: QuestionFormat | null;
  section_index: number | null;                                         // NEW
  bank_position: number | null;                                         // NEW
  verified: boolean;                                                    // NEW
  image: { prompt: string; alt: string; url?: string } | null;         // NEW
};
```

In every `.select()` call in `questions.ts`, replace the select string:

Old: `"id, topic_id, prompt, markscheme, max_marks, model_answer, format"`

New: `"id, topic_id, prompt, markscheme, max_marks, model_answer, format, section_index, bank_position, verified, image"`

(There are five such calls: `getQuestionForTopic`, `getQuestionById`, `createQuestion`, `getQuestionForSubtopic`, `createQuestionForSubtopic`.)

- [ ] **Step 2: Create `lib/supabase/question-bank.ts`**

```typescript
import "server-only";
import { createServiceClient } from "./server";
import type { BankedQuestion } from "@/lib/ai/question-bank";
import type { Question } from "./questions";
import type { QuestionFormat } from "@/lib/ai/questions";

const QUESTION_SELECT =
  "id, topic_id, prompt, markscheme, max_marks, model_answer, format, section_index, bank_position, verified, image";

export async function createQuestionBank(
  topicId: string,
  questions: BankedQuestion[],
  classId?: string | null
): Promise<void> {
  const supabase = createServiceClient();
  const rows = questions.map((q) => ({
    topic_id:      topicId,
    class_id:      classId ?? null,
    prompt:        q.prompt,
    markscheme:    q.markscheme,
    max_marks:     q.maxMarks,
    model_answer:  q.modelAnswer,
    format:        q.format ?? null,
    image:         q.image ?? null,
    section_index: q.sectionIndex,
    bank_position: q.bankPosition,
    verified:      false,
  }));
  const { error } = await supabase.from("questions").insert(rows);
  if (error) throw error;
}

export async function getQuestionBank(
  topicId: string,
  classId?: string | null
): Promise<Question[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .eq("topic_id", topicId)
    .not("bank_position", "is", null)
    .order("bank_position", { ascending: true });
  query = classId ? query.eq("class_id", classId) : query.is("class_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createQuestionBankForSubtopic(
  topicId: string,
  subtopicId: string,
  questions: BankedQuestion[]
): Promise<void> {
  const supabase = createServiceClient();
  const rows = questions.map((q) => ({
    topic_id:      topicId,
    subtopic_id:   subtopicId,
    prompt:        q.prompt,
    markscheme:    q.markscheme,
    max_marks:     q.maxMarks,
    model_answer:  q.modelAnswer,
    format:        q.format ?? null,
    image:         q.image ?? null,
    section_index: q.sectionIndex,
    bank_position: q.bankPosition,
    verified:      false,
  }));
  const { error } = await supabase.from("questions").insert(rows);
  if (error) throw error;
}

export async function getQuestionBankForSubtopic(subtopicId: string): Promise<Question[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .eq("subtopic_id", subtopicId)
    .not("bank_position", "is", null)
    .order("bank_position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function verifyBankQuestion(questionId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("questions")
    .update({ verified: true })
    .eq("id", questionId);
  if (error) throw error;
}

export async function updateBankQuestion(
  questionId: string,
  patch: {
    prompt?: string;
    markscheme?: { point: string }[];
    max_marks?: number;
    model_answer?: string;
    format?: QuestionFormat | null;
  }
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("questions")
    .update(patch)
    .eq("id", questionId);
  if (error) throw error;
}

export async function createQuestionSession(
  studentId: string,
  topicId?: string | null,
  subtopicId?: string | null
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("question_sessions")
    .insert({
      student_id:  studentId,
      topic_id:    topicId    ?? null,
      subtopic_id: subtopicId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function recordSessionAttempt(
  sessionId: string,
  questionId: string,
  correct: boolean,
  isRetry: boolean
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("question_session_attempts").insert({
    session_id:  sessionId,
    question_id: questionId,
    correct,
    is_retry:    isRetry,
  });
  if (error) throw error;
}

export async function completeSession(
  sessionId: string,
  masteryExit: boolean
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("question_sessions")
    .update({
      completed_at: new Date().toISOString(),
      mastery_exit: masteryExit,
    })
    .eq("id", sessionId);
  if (error) throw error;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/question-bank.ts lib/supabase/questions.ts
git commit -m "feat: question bank and session DB layer"
```

---

## Task 4: Content Pipeline + Question Image Finalization

**Files:**
- Modify: `lib/content-pipeline.ts`
- Create: `lib/question-finalize.ts`

**Interfaces:**
- Consumes: `generateQuestionBank`, `BankedQuestion` from `lib/ai/question-bank.ts`; `createQuestionBank`, `getQuestionBank` from `lib/supabase/question-bank.ts`; `generateLessonImage` from `lib/ai/images.ts`; `uploadFile`, `getFileUrl` from `lib/appwrite/storage.ts`
- Produces: `finalizeQuestionBank(questions, topicId): Promise<BankedQuestion[]>`; updated `pregenerateTopicContent`

- [ ] **Step 1: Create `lib/question-finalize.ts`**

```typescript
import "server-only";
import type { BankedQuestion } from "@/lib/ai/question-bank";
import { generateLessonImage } from "@/lib/ai/images";

// Fills in image.url for any question that has an image prompt.
// Uses the same generateLessonImage function as lessons — it never throws,
// returning null on any failure, so a bad image never blocks the bank.
export async function finalizeQuestionBank(
  questions: BankedQuestion[],
  topicId: string
): Promise<BankedQuestion[]> {
  return Promise.all(
    questions.map(async (q) => {
      if (!q.image?.prompt) return q;
      const url = await generateLessonImage(q.image.prompt, topicId);
      if (!url) return { ...q, image: null }; // drop rather than show broken
      return { ...q, image: { ...q.image, url } };
    })
  );
}
```

- [ ] **Step 2: Rewrite `lib/content-pipeline.ts`**

```typescript
import "server-only";
import { getTopic } from "@/lib/supabase/topics";
import { getLessonByTopic, createLesson } from "@/lib/supabase/lessons";
import { getQuestionBank, createQuestionBank } from "@/lib/supabase/question-bank";
import { generateLesson } from "@/lib/ai/lessons";
import { generateQuestionBank } from "@/lib/ai/question-bank";
import { resolveProviderConfig } from "@/lib/ai/client";
import { finalizeLessonContent } from "@/lib/lesson-finalize";
import { finalizeQuestionBank } from "@/lib/question-finalize";
import { withReferenceContext } from "@/lib/rag";

// Generates and stores a lesson + 10-question bank for a topic.
// Lesson is generated first — bank generation requires section headings
// as context so it can tag questions to the right sections.
// Safe to call multiple times: skips whatever already exists.
export async function pregenerateTopicContent(
  topicId: string,
  requestedBy?: string | null
): Promise<void> {
  const topic = await getTopic(topicId);
  if (!topic) return;

  const config = await resolveProviderConfig(requestedBy);
  const instructions = await withReferenceContext(
    topicId,
    topic.name,
    topic.custom_instructions
  );

  // Lesson must exist first so we can pass section context to the bank
  let lesson = await getLessonByTopic(topicId);
  if (!lesson) {
    const generated = await generateLesson(
      topic.name,
      topic.subject.name,
      false,
      instructions,
      config
    );
    lesson = await finalizeLessonContent(generated, topicId);
    await createLesson(topicId, lesson);
  }

  // Generate bank only if it doesn't exist yet
  const existingBank = await getQuestionBank(topicId);
  if (existingBank.length === 0) {
    const sections = lesson.sections.map((s) => ({
      heading:     s.heading,
      explanation: s.explanation,
    }));
    const bank = await generateQuestionBank(
      topic.name,
      topic.subject.name,
      sections,
      instructions,
      config
    );
    const finalized = await finalizeQuestionBank(bank, topicId);
    await createQuestionBank(topicId, finalized);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/content-pipeline.ts lib/question-finalize.ts
git commit -m "feat: wire question bank + image finalization into content pipeline"
```

---

## Task 5: Adaptive Practice Session

**Files:**
- Modify: `app/actions/practice.ts`
- Modify: `app/practice/[topicId]/page.tsx`
- Modify: `app/practice/[topicId]/answer-form.tsx`

**Interfaces:**
- Consumes: `getQuestionBank`, `createQuestionSession`, `recordSessionAttempt`, `completeSession` from `lib/supabase/question-bank.ts`; `getQuestionById` from `lib/supabase/questions.ts`; `toClientFormat` from `lib/question-client.ts`
- Produces: `startPracticeSessionAction`, `submitBankedAnswerAction` server actions; session-aware practice page

The session state is encoded in URL search params (`?sid=<sessionId>&q=<questionId>&queue=<id,id,...>&retry=<id,id,...>&fac=<number>`) so it survives page refreshes without extra server-side state.

- [ ] **Step 1: Add new server actions to `app/actions/practice.ts`**

First read the existing file in full, then add these two actions at the bottom (keeping all existing actions intact):

```typescript
// Imports to add at the top of the file (alongside existing imports):
// import { getQuestionBank, createQuestionSession, recordSessionAttempt, completeSession } from "@/lib/supabase/question-bank";

export async function startPracticeSessionAction(topicId: string): Promise<{
  sessionId: string;
  questionId: string;
  queue: string[];
}> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const bank = await getQuestionBank(topicId);
  if (bank.length === 0) throw new Error("No question bank for this topic yet.");

  const sessionId = await createQuestionSession(profile.id, topicId, null);
  const ids = bank.map((q) => q.id);
  const [first, ...rest] = ids;
  return { sessionId, questionId: first, queue: rest };
}

export async function submitBankedAnswerAction(input: {
  sessionId: string;
  questionId: string;
  correct: boolean;
  isRetry: boolean;
  queue: string[];
  retryQueue: string[];
  firstAttemptCorrect: number;
}): Promise<{
  nextQuestionId: string | null;
  queue: string[];
  retryQueue: string[];
  masteryExit: boolean;
  firstAttemptCorrect: number;
}> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);

  await recordSessionAttempt(
    input.sessionId,
    input.questionId,
    input.correct,
    input.isRetry
  );

  // Only first-attempt correct answers count toward mastery
  const newFac = input.isRetry
    ? input.firstAttemptCorrect
    : input.correct
      ? input.firstAttemptCorrect + 1
      : input.firstAttemptCorrect;

  // Wrong first-attempt answers join the retry queue
  const newRetryQueue =
    !input.correct && !input.isRetry
      ? [...input.retryQueue, input.questionId]
      : input.retryQueue;

  // Mastery: 4 first-attempt correct → early exit (students only)
  if (profile.role === "student" && newFac >= 4) {
    await completeSession(input.sessionId, true);
    return {
      nextQuestionId: null,
      queue: [],
      retryQueue: [],
      masteryExit: true,
      firstAttemptCorrect: newFac,
    };
  }

  // Serve from main queue first, then retry queue
  const combined = [...input.queue, ...newRetryQueue];
  if (combined.length === 0) {
    await completeSession(input.sessionId, false);
    return {
      nextQuestionId: null,
      queue: [],
      retryQueue: [],
      masteryExit: false,
      firstAttemptCorrect: newFac,
    };
  }

  const [next, ...remaining] = combined;
  // Partition remaining back into queue vs retry
  const retrySet = new Set(newRetryQueue);
  const queueSet = new Set(input.queue);
  const nextRetryQueue = remaining.filter((id) => retrySet.has(id) && !queueSet.has(id));
  const nextQueue      = remaining.filter((id) => !nextRetryQueue.includes(id));

  return {
    nextQuestionId: next,
    queue: nextQueue,
    retryQueue: nextRetryQueue,
    masteryExit: false,
    firstAttemptCorrect: newFac,
  };
}
```

- [ ] **Step 2: Update `app/practice/[topicId]/page.tsx`**

Read the file first, then replace the question-fetching logic. The page now reads session params from `searchParams` and redirects to a new session if none exist:

```typescript
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { getQuestionById } from "@/lib/supabase/questions";
import { getQuestionBank, createQuestionSession } from "@/lib/supabase/question-bank";
import { toClientFormat } from "@/lib/question-client";
import { AnswerForm } from "./answer-form";
import { ReportButton } from "@/components/report-button";

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ sid?: string; q?: string; queue?: string; retry?: string; fac?: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { topicId } = await params;
  const sp = await searchParams;

  const topic = await getTopic(topicId);
  if (!topic) notFound();

  // No session yet — start one and redirect
  if (!sp.sid || !sp.q) {
    const bank = await getQuestionBank(topicId);
    if (bank.length === 0) {
      // Fallback: no bank yet, use legacy single-question path
      // (resolveQuestionContent handles on-demand generation)
      const { resolveQuestionContent } = await import("@/lib/class-content");
      const question = await resolveQuestionContent(topic, profile);
      return renderPage(topic, question, profile, topicId, null);
    }
    const sessionId = await createQuestionSession(profile.id, topicId, null);
    const ids = bank.map((q) => q.id);
    const [first, ...rest] = ids;
    redirect(
      `/practice/${topicId}?sid=${sessionId}&q=${first}&queue=${rest.join(",")}&retry=&fac=0`
    );
  }

  const question = await getQuestionById(sp.q);
  if (!question) notFound();

  const queue      = sp.queue ? sp.queue.split(",").filter(Boolean) : [];
  const retryQueue = sp.retry ? sp.retry.split(",").filter(Boolean) : [];
  const fac        = parseInt(sp.fac ?? "0", 10);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-xs text-highlight">
          Previewing as {profile.role} — answers here won&apos;t earn XP.
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {topic.subject.name} · {topic.name}
        </p>
        {question.image?.url && (
          <img
            src={question.image.url}
            alt={question.image.alt ?? ""}
            className="mt-4 max-h-64 w-full rounded-xl border border-border object-contain"
          />
        )}
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          {question.prompt}
        </h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-highlight">
          {question.max_marks} marks
        </p>
      </div>

      <ReportButton
        contextLabel={`Practice question: ${topic.name}`}
        topicId={topicId}
        questionId={question.id}
      />

      <AnswerForm
        topicId={topicId}
        questionId={question.id}
        format={toClientFormat(question.format)}
        sessionId={sp.sid}
        queue={queue}
        retryQueue={retryQueue}
        firstAttemptCorrect={fac}
      />
    </main>
  );
}
```

- [ ] **Step 3: Update `app/practice/[topicId]/answer-form.tsx` to carry session state**

Read the file fully first, then add the following changes:

1. Add new props to `AnswerForm`:

```typescript
// Add to props:
sessionId?: string;
queue?: string[];
retryQueue?: string[];
firstAttemptCorrect?: number;
```

2. Add hidden inputs for session state inside `<form>`:

```tsx
{sessionId && (
  <>
    <input type="hidden" name="sessionId"           value={sessionId} />
    <input type="hidden" name="queue"               value={(queue ?? []).join(",")} />
    <input type="hidden" name="retryQueue"          value={(retryQueue ?? []).join(",")} />
    <input type="hidden" name="firstAttemptCorrect" value={String(firstAttemptCorrect ?? 0)} />
  </>
)}
```

3. Replace the "Try a similar question" form (after the result panel) with a "Next question" button that calls `submitBankedAnswerAction` when session state is present, falling back to `newSimilarQuestionAction` when not:

```tsx
{sessionId ? (
  <form action={async (fd: FormData) => {
    "use server";
    // This inline action is not valid in answer-form.tsx (client component).
    // Instead, wire nextQuestion via a new server action imported at top.
  }}>
    {/* see step 4 */}
  </form>
) : (
  <form action={newSimilarQuestionAction}>
    <input type="hidden" name="topicId" value={topicId} />
    <Button type="submit" variant="secondary" size="compact">Try a similar question</Button>
  </form>
)}
```

4. Since `answer-form.tsx` is a client component, add a new `nextBankedQuestionAction` server action in `app/actions/practice.ts` that wraps `submitBankedAnswerAction` and returns a redirect URL, then call it from the client via `useRouter().push(url)`:

```typescript
// In app/actions/practice.ts — add:
export async function nextBankedQuestionAction(input: {
  topicId: string;
  sessionId: string;
  questionId: string;
  correct: boolean;
  isRetry: boolean;
  queue: string[];
  retryQueue: string[];
  firstAttemptCorrect: number;
}): Promise<{ redirectTo: string }> {
  const result = await submitBankedAnswerAction({
    sessionId:           input.sessionId,
    questionId:          input.questionId,
    correct:             input.correct,
    isRetry:             input.isRetry,
    queue:               input.queue,
    retryQueue:          input.retryQueue,
    firstAttemptCorrect: input.firstAttemptCorrect,
  });

  if (result.nextQuestionId === null) {
    // Session complete — go to a done page (reuse existing practice page with a done param)
    return { redirectTo: `/practice/${input.topicId}?done=1&mastery=${result.masteryExit}` };
  }

  const params = new URLSearchParams({
    sid:   input.sessionId,
    q:     result.nextQuestionId,
    queue: result.queue.join(","),
    retry: result.retryQueue.join(","),
    fac:   String(result.firstAttemptCorrect),
  });
  return { redirectTo: `/practice/${input.topicId}?${params}` };
}
```

In `answer-form.tsx`, after a result is shown, add a "Next question →" button that calls `nextBankedQuestionAction` and navigates to the returned URL using `useRouter`:

```tsx
import { useRouter } from "next/navigation";
import { nextBankedQuestionAction } from "@/app/actions/practice";

// Inside the result panel, replace the "Try a similar question" form when sessionId is present:
{sessionId && result && (
  <button
    type="button"
    onClick={async () => {
      const { redirectTo } = await nextBankedQuestionAction({
        topicId,
        sessionId,
        questionId,
        correct: result.marksAwarded === result.maxMarks,
        isRetry: false, // AnswerForm doesn't know if this is a retry — server determines from DB
        queue:               queue   ?? [],
        retryQueue:          retryQueue ?? [],
        firstAttemptCorrect: firstAttemptCorrect ?? 0,
      });
      router.push(redirectTo);
    }}
    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
  >
    Next question →
  </button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/practice.ts app/practice/[topicId]/page.tsx app/practice/[topicId]/answer-form.tsx
git commit -m "feat: adaptive question bank practice sessions with 4-correct mastery exit"
```

---

## Task 6: Interactive Clarification Components

**Files:**
- Create: `components/interactive/step-reveal.tsx`
- Create: `components/interactive/fill-gap.tsx`
- Create: `components/interactive/sort-order.tsx`
- Create: `components/interactive/match-connect.tsx`
- Create: `components/interactive/index.ts`

All components are `"use client"`. They call `onComplete()` once the student successfully finishes the activity. Colors use CSS token variables (`var(--color-primary)` etc. via the existing Tailwind token classes — `text-primary`, `bg-success/10`, etc.).

**Interfaces:**
- Produces:
  - `StepReveal({ steps: string[], onComplete: () => void })`
  - `FillGap({ template: string, options: string[], answerIndex: number, onComplete: () => void })`
  - `SortOrder({ items: string[], correctOrder: number[], onComplete: () => void })`
  - `MatchConnect({ pairs: { left: string; right: string }[], onComplete: () => void })`

- [ ] **Step 1: Create `components/interactive/step-reveal.tsx`**

Student reveals each step one at a time. After the last step, a "Got it ✓" button fires `onComplete`.

```tsx
"use client";
import { useState } from "react";
import { RichText } from "@/components/rich-text";
import { Button } from "@/components/button";

export function StepReveal({
  steps,
  onComplete,
}: {
  steps: string[];
  onComplete: () => void;
}) {
  const [revealed, setRevealed] = useState(1);

  return (
    <div className="flex flex-col gap-3">
      {steps.slice(0, revealed).map((step, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-xl border border-border bg-surface p-4 animate-fade-slide-up"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {i + 1}
          </span>
          <p className="text-sm text-foreground">
            <RichText text={step} />
          </p>
        </div>
      ))}

      {revealed < steps.length ? (
        <button
          type="button"
          onClick={() => setRevealed((r) => r + 1)}
          className="self-start rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          Show step {revealed + 1} →
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-secondary/40 bg-secondary/5 p-4">
          <p className="flex-1 text-sm font-medium text-foreground">All steps shown — does that make sense?</p>
          <Button size="compact" onClick={onComplete}>Got it ✓</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/interactive/fill-gap.tsx`**

Sentence with a `___` gap. Student clicks an option to fill it. Correct → brief green state then `onComplete`. Wrong → option struck out, try again.

```tsx
"use client";
import { useState } from "react";
import { RichText } from "@/components/rich-text";

export function FillGap({
  template,
  options,
  answerIndex,
  onComplete,
}: {
  template: string;
  options: string[];
  answerIndex: number;
  onComplete: () => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [wrong, setWrong] = useState<Set<number>>(new Set());

  const parts = template.split("___");

  function choose(i: number) {
    if (wrong.has(i) || chosen !== null) return;
    if (i === answerIndex) {
      setChosen(i);
      setTimeout(onComplete, 900);
    } else {
      setWrong((prev) => new Set(prev).add(i));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground leading-relaxed">
        <RichText text={parts[0]} />
        <span
          className={`mx-1 inline-block min-w-16 rounded-md border px-2 py-0.5 text-center font-semibold transition-colors ${
            chosen !== null
              ? "border-success bg-success/10 text-success"
              : "border-primary/50 bg-primary/5 text-primary"
          }`}
        >
          {chosen !== null ? options[chosen] : "___"}
        </span>
        <RichText text={parts[1] ?? ""} />
      </p>

      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => choose(i)}
            disabled={wrong.has(i) || chosen !== null}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              chosen === i
                ? "border-success bg-success/10 text-success"
                : wrong.has(i)
                  ? "border-error/40 bg-error/5 text-error line-through"
                  : "border-border bg-surface text-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/interactive/sort-order.tsx`**

Items start shuffled. Student drags them into the correct order. When correct, turns green and calls `onComplete`.

```tsx
"use client";
import { useRef, useState } from "react";
import { RichText } from "@/components/rich-text";

function shuffle(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Ensure the shuffle is not already in correct order
  const correct = arr.map((_, i) => i);
  return a.every((v, i) => v === correct[i]) ? shuffle(arr) : a;
}

export function SortOrder({
  items,
  correctOrder,
  onComplete,
}: {
  items: string[];
  correctOrder: number[];
  onComplete: () => void;
}) {
  const [order, setOrder] = useState<number[]>(() =>
    shuffle(items.map((_, i) => i))
  );
  const [correct, setCorrect] = useState(false);
  const dragging = useRef<number | null>(null);

  function handleDrop(targetPos: number) {
    if (dragging.current === null || dragging.current === targetPos) return;
    const next = [...order];
    const [moved] = next.splice(dragging.current, 1);
    next.splice(targetPos, 0, moved);
    setOrder(next);
    dragging.current = null;

    if (next.every((origIdx, pos) => origIdx === correctOrder[pos])) {
      setCorrect(true);
      setTimeout(onComplete, 700);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">Drag to put these in the correct order.</p>
      {order.map((origIdx, pos) => (
        <div
          key={origIdx}
          draggable
          onDragStart={() => { dragging.current = pos; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(pos)}
          className={`flex cursor-grab items-center gap-3 rounded-xl border p-3 text-sm select-none transition-colors active:cursor-grabbing ${
            correct
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-surface text-foreground hover:border-primary/40"
          }`}
        >
          <span className="text-muted select-none">⠿</span>
          <RichText text={items[origIdx]} />
        </div>
      ))}
      {correct && (
        <p className="text-sm font-medium text-success animate-fade-slide-up">✓ Correct order!</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/interactive/match-connect.tsx`**

Left column + right column (shuffled). Click left then right to connect. Correct connections lock green. Wrong flashes red. All matched → `onComplete`.

```tsx
"use client";
import { useMemo, useState } from "react";
import { RichText } from "@/components/rich-text";

export function MatchConnect({
  pairs,
  onComplete,
}: {
  pairs: { left: string; right: string }[];
  onComplete: () => void;
}) {
  // Shuffle right column once on mount
  const shuffledRights = useMemo(() => {
    const idxs = pairs.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    return idxs; // shuffledRights[displayPos] = original pairs index
  }, [pairs]);

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  // matched[leftIdx] = displayPos in shuffledRights
  const [matched, setMatched] = useState<Record<number, number>>({});
  const [flashWrong, setFlashWrong] = useState<{ l: number; r: number } | null>(null);

  const matchedDisplayPositions = new Set(Object.values(matched));

  function clickLeft(leftIdx: number) {
    if (matched[leftIdx] !== undefined) return;
    setSelectedLeft(leftIdx);
    setFlashWrong(null);
  }

  function clickRight(displayPos: number) {
    if (matchedDisplayPositions.has(displayPos) || selectedLeft === null) return;
    const originalRightIdx = shuffledRights[displayPos];
    if (originalRightIdx === selectedLeft) {
      // Correct: left index matches right index in pairs array
      const next = { ...matched, [selectedLeft]: displayPos };
      setMatched(next);
      setSelectedLeft(null);
      if (Object.keys(next).length === pairs.length) setTimeout(onComplete, 600);
    } else {
      setFlashWrong({ l: selectedLeft, r: displayPos });
      setTimeout(() => { setFlashWrong(null); setSelectedLeft(null); }, 700);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2">
        {pairs.map((pair, leftIdx) => (
          <button
            key={leftIdx}
            type="button"
            onClick={() => clickLeft(leftIdx)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              matched[leftIdx] !== undefined
                ? "border-success/40 bg-success/10 text-success"
                : flashWrong?.l === leftIdx
                  ? "border-error/40 bg-error/5 text-error"
                  : selectedLeft === leftIdx
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-foreground hover:border-primary/50"
            }`}
          >
            <RichText text={pair.left} />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {shuffledRights.map((origIdx, displayPos) => (
          <button
            key={displayPos}
            type="button"
            onClick={() => clickRight(displayPos)}
            disabled={matchedDisplayPositions.has(displayPos)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${
              matchedDisplayPositions.has(displayPos)
                ? "border-success/40 bg-success/10 text-success"
                : flashWrong?.r === displayPos
                  ? "border-error/40 bg-error/5 text-error"
                  : selectedLeft !== null
                    ? "border-primary/30 bg-surface text-foreground hover:border-primary"
                    : "border-border bg-surface text-muted"
            }`}
          >
            <RichText text={pairs[origIdx].right} />
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/interactive/index.ts`**

```typescript
export { StepReveal }   from "./step-reveal";
export { FillGap }      from "./fill-gap";
export { SortOrder }    from "./sort-order";
export { MatchConnect } from "./match-connect";
```

- [ ] **Step 6: Commit**

```bash
git add components/interactive/
git commit -m "feat: interactive clarification components (step-reveal, fill-gap, sort-order, match-connect)"
```

---

## Task 7: Post-Lesson Interactive Clarification

**Files:**
- Create: `lib/ai/clarification.ts`
- Create: `app/actions/clarification.ts`
- Create: `app/learn/[topicId]/clarification-player.tsx`
- Modify: `app/learn/[topicId]/lesson-player.tsx`

**Interfaces:**
- Consumes: `chatJson`, `ProviderConfig` from `lib/ai/client.ts`; `resolveProviderConfig` from `lib/ai/client.ts`; `getTopic` from `lib/supabase/topics.ts`; `requireAnyRole` from `lib/appwrite/session.ts`; interactive components from `components/interactive/`
- Produces:
  - `SectionClarification` type
  - `InteractiveContent` type
  - `generateClarifications(topicName, subjectName, wrongSections, config?): Promise<SectionClarification[]>`
  - `generateClarificationsAction` server action
  - `ClarificationPlayer` component

- [ ] **Step 1: Create `lib/ai/clarification.ts`**

```typescript
import "server-only";
import { chatJson, type ProviderConfig } from "./client";

export type InteractiveContent =
  | { kind: "step-reveal"; steps: string[] }
  | { kind: "fill-gap"; template: string; options: string[]; answerIndex: number }
  | { kind: "sort-order"; items: string[]; correctOrder: number[] }
  | { kind: "match-connect"; pairs: { left: string; right: string }[] };

export type SectionClarification = {
  sectionIndex: number;
  heading: string;
  explanation: string;
  interactive: InteractiveContent;
};

const SCHEMA = {
  type: "object",
  properties: {
    clarifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionIndex: { type: "integer" },
          heading:      { type: "string" },
          explanation:  { type: "string" },
          interactive: {
            type: "object",
            properties: {
              kind:        { type: "string", enum: ["step-reveal", "fill-gap", "sort-order", "match-connect"] },
              steps:       { type: "array", items: { type: "string" } },
              template:    { type: "string" },
              options:     { type: "array", items: { type: "string" } },
              answerIndex: { type: "integer" },
              items:       { type: "array", items: { type: "string" } },
              correctOrder:{ type: "array", items: { type: "integer" } },
              pairs: {
                type: "array",
                items: {
                  type: "object",
                  properties: { left: { type: "string" }, right: { type: "string" } },
                  required: ["left", "right"],
                },
              },
            },
            required: ["kind", "steps", "template", "options", "answerIndex", "items", "correctOrder", "pairs"],
          },
        },
        required: ["sectionIndex", "heading", "explanation", "interactive"],
      },
    },
  },
  required: ["clarifications"],
};

export async function generateClarifications(
  topicName: string,
  subjectName: string,
  wrongSections: {
    sectionIndex: number;
    heading: string;
    explanation: string;
    example: string;
  }[],
  config?: ProviderConfig
): Promise<SectionClarification[]> {
  if (wrongSections.length === 0) return [];

  const sectionList = wrongSections
    .map(
      (s) =>
        `Section ${s.sectionIndex} — "${s.heading}":\n` +
        `Original explanation: ${s.explanation}\n` +
        `Original example: ${s.example}`
    )
    .join("\n\n");

  const interactiveGuide =
    `For each section, choose ONE interactive format that best helps the student rebuild understanding:\n` +
    `- "step-reveal": break a worked example or process into 3-5 short numbered steps the student reveals one at a time. ` +
    `Best for calculations, sequences, or multi-step reasoning. "steps" = array of step strings.\n` +
    `- "fill-gap": write a key sentence with one blank (use ___ where the blank goes). ` +
    `"options" = 3-4 choices (strings), "answerIndex" = index of correct one (0-based).\n` +
    `- "sort-order": 4-5 items in scrambled order the student must sort. ` +
    `"items" = the items (strings), "correctOrder" = array of their original indices in the correct sequence.\n` +
    `- "match-connect": 3-4 pairs connecting terms to definitions, causes to effects, etc. ` +
    `"pairs" = array of {left, right} objects.\n\n` +
    `All four interactive fields are required by the schema even for unchosen kinds — ` +
    `use empty arrays, 0, or "" for unused fields.\n` +
    `Write plain prose, no markdown symbols. Math as $...$ (inline LaTeX) or $$...$$ (standalone).\n` +
    `The explanation should re-teach the concept in simpler, different words than the original.`;

  const result = await chatJson<{ clarifications: SectionClarification[] }>(
    `A student just got the following quick-check questions wrong in a GCSE lesson on ` +
      `"${topicName}" (${subjectName}). For each section they struggled with, write:\n` +
      `1. A short re-explanation in simpler language (2-3 sentences, fresh angle)\n` +
      `2. One interactive activity that makes them actively reconstruct the concept\n\n` +
      `Sections the student struggled with:\n\n${sectionList}\n\n${interactiveGuide}`,
    SCHEMA,
    config
  );

  return result.clarifications;
}
```

- [ ] **Step 2: Create `app/actions/clarification.ts`**

```typescript
"use server";

import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { resolveProviderConfig } from "@/lib/ai/client";
import { generateClarifications, type SectionClarification } from "@/lib/ai/clarification";

export async function generateClarificationsAction(input: {
  topicId: string;
  wrongSections: {
    sectionIndex: number;
    heading: string;
    explanation: string;
    example: string;
  }[];
}): Promise<SectionClarification[]> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const topic = await getTopic(input.topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  return generateClarifications(
    topic.name,
    topic.subject.name,
    input.wrongSections,
    config
  );
}
```

- [ ] **Step 3: Create `app/learn/[topicId]/clarification-player.tsx`**

```tsx
"use client";
import { useState } from "react";
import { RichText } from "@/components/rich-text";
import { Button } from "@/components/button";
import {
  StepReveal,
  FillGap,
  SortOrder,
  MatchConnect,
} from "@/components/interactive";
import type { SectionClarification } from "@/lib/ai/clarification";

export function ClarificationPlayer({
  clarifications,
  onDone,
}: {
  clarifications: SectionClarification[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [interactiveDone, setInteractiveDone] = useState(false);

  const current = clarifications[index];
  const isLast = index === clarifications.length - 1;

  function advance() {
    if (isLast) {
      onDone();
      return;
    }
    setIndex((i) => i + 1);
    setInteractiveDone(false);
  }

  function renderInteractive(c: SectionClarification) {
    const ia = c.interactive;
    switch (ia.kind) {
      case "step-reveal":
        return (
          <StepReveal steps={ia.steps} onComplete={() => setInteractiveDone(true)} />
        );
      case "fill-gap":
        return (
          <FillGap
            template={ia.template}
            options={ia.options}
            answerIndex={ia.answerIndex}
            onComplete={() => setInteractiveDone(true)}
          />
        );
      case "sort-order":
        return (
          <SortOrder
            items={ia.items}
            correctOrder={ia.correctOrder}
            onComplete={() => setInteractiveDone(true)}
          />
        );
      case "match-connect":
        return (
          <MatchConnect
            pairs={ia.pairs}
            onComplete={() => setInteractiveDone(true)}
          />
        );
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6 animate-fade-slide-up">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        ✦ Let&apos;s revisit · {index + 1} of {clarifications.length}
      </p>
      <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        <RichText text={current.heading} />
      </p>
      <p className="text-sm text-foreground">
        <RichText text={current.explanation} />
      </p>
      {renderInteractive(current)}
      {interactiveDone && (
        <Button onClick={advance} className="self-start animate-fade-slide-up">
          {isLast ? "All done →" : "Next →"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Extend `app/learn/[topicId]/lesson-player.tsx`**

Read the full file first, then make these targeted changes:

**4a — Extend the `Step` union type** (add `clarify` phase before `done`):

```typescript
type Step =
  | { phase: "teach"; sectionIndex: number }
  | { phase: "check"; sectionIndex: number }
  | { phase: "clarify"; clarifications: SectionClarification[] }  // ADD
  | { phase: "done" };
```

**4b — Add new imports** at the top of the file:

```typescript
import { generateClarificationsAction } from "@/app/actions/clarification";
import type { SectionClarification } from "@/lib/ai/clarification";
import { ClarificationPlayer } from "./clarification-player";
```

**4c — Add `wrongSections` state** alongside the existing state declarations:

```typescript
const [wrongSections, setWrongSections] = useState<
  { sectionIndex: number; heading: string; explanation: string; example: string }[]
>([]);
```

**4d — Track wrong sections in the `onResult` callback** inside the `QuickCheck` block. Find the existing line `} else if (firstTry) {` and add section tracking:

```typescript
} else if (firstTry) {
  setWrongSections((prev) => [
    ...prev,
    {
      sectionIndex: step.sectionIndex,
      heading:      sections[step.sectionIndex].heading,
      explanation:  sections[step.sectionIndex].explanation,
      example:      sections[step.sectionIndex].example,
    },
  ]);
  requestAdaptation(step.sectionIndex);
}
```

**4e — Update `finish()`** to generate clarifications before setting done:

```typescript
async function finish() {
  setStep({ phase: "done" }); // optimistic done to stop showing lesson
  celebrate();
  const result = await completeLessonAction(topicId, mode);
  setXp(result.xp);

  if (wrongSections.length > 0) {
    try {
      const clarifications = await generateClarificationsAction({
        topicId: coachTopicId ?? topicId,
        wrongSections,
      });
      if (clarifications.length > 0) {
        setStep({ phase: "clarify", clarifications });
        return;
      }
    } catch {
      // Clarification failure is non-fatal — stay on done
    }
  }
  // Already set to done above
}
```

**4f — Add `clarify` phase render** in the JSX, between the `check` block and the `done` block:

```tsx
{step.phase === "clarify" && (
  <ClarificationPlayer
    clarifications={step.clarifications}
    onDone={() => setStep({ phase: "done" })}
  />
)}
```

**4g — Update `stepKey`** so the animation re-triggers on clarify:

```typescript
const stepKey =
  step.phase === "done"    ? "done"                            :
  step.phase === "clarify" ? "clarify"                         :
  `${step.phase}-${step.sectionIndex}`;
```

- [ ] **Step 5: Commit**

```bash
git add lib/ai/clarification.ts app/actions/clarification.ts app/learn/[topicId]/clarification-player.tsx app/learn/[topicId]/lesson-player.tsx
git commit -m "feat: post-lesson interactive clarification for wrong quick checks"
```

---

## Task 8: Teacher Question Bank Review UI

**Files:**
- Modify: `app/actions/subjects.ts`
- Modify: `app/admin/subjects/page.tsx`

**Interfaces:**
- Consumes: `getQuestionBank` from `lib/supabase/question-bank.ts`; `verifyBankQuestion`, `updateBankQuestion`, `createQuestionBank` from `lib/supabase/question-bank.ts`; `generateQuestionBank` from `lib/ai/question-bank.ts`; `getLessonByTopic` from `lib/supabase/lessons.ts`; `getTopic` from `lib/supabase/topics.ts`; `createServiceClient` from `lib/supabase/server.ts`

- [ ] **Step 1: Add three actions to `app/actions/subjects.ts`**

Read the file in full first, then add these at the bottom alongside the existing actions. Add the required imports (grouped with the existing import block):

```typescript
// Add to existing imports:
import {
  getQuestionBank,
  createQuestionBank,
  verifyBankQuestion,
  updateBankQuestion,
} from "@/lib/supabase/question-bank";
import { generateQuestionBank } from "@/lib/ai/question-bank";
import { finalizeQuestionBank } from "@/lib/question-finalize";
import { createServiceClient } from "@/lib/supabase/server";
```

```typescript
export async function verifyQuestionAction(formData: FormData): Promise<void> {
  await requireAnyRole(["admin", "teacher"]);
  const questionId = formData.get("questionId");
  if (typeof questionId !== "string") throw new Error("Missing questionId.");
  await verifyBankQuestion(questionId);
  revalidatePath("/admin/subjects");
}

export async function updateQuestionAction(formData: FormData): Promise<void> {
  await requireAnyRole(["admin", "teacher"]);
  const questionId  = formData.get("questionId");
  const prompt      = formData.get("prompt");
  const modelAnswer = formData.get("modelAnswer");
  if (
    typeof questionId  !== "string" ||
    typeof prompt      !== "string" ||
    typeof modelAnswer !== "string"
  ) throw new Error("Missing fields.");

  await updateBankQuestion(questionId, {
    prompt,
    model_answer: modelAnswer,
  });
  revalidatePath("/admin/subjects");
}

export async function regenerateQuestionBankAction(formData: FormData): Promise<void> {
  await requireAnyRole(["admin", "teacher"]);
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const lesson = await getLessonByTopic(topicId);
  if (!lesson) throw new Error("Generate the lesson first — the question bank needs section headings from it.");

  const config = await resolveProviderConfig(null); // platform default
  const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
  const sections = lesson.sections.map((s) => ({
    heading:     s.heading,
    explanation: s.explanation,
  }));

  const bank     = await generateQuestionBank(topic.name, topic.subject.name, sections, instructions, config);
  const finalized = await finalizeQuestionBank(bank, topicId);

  // Delete existing bank rows for this topic before inserting fresh ones
  const supabase = createServiceClient();
  await supabase
    .from("questions")
    .delete()
    .eq("topic_id", topicId)
    .not("bank_position", "is", null);

  await createQuestionBank(topicId, finalized);
  revalidatePath("/admin/subjects");
}
```

- [ ] **Step 2: Load question banks in `app/admin/subjects/page.tsx`**

Read the file in full, then add two lines to the data-loading section (alongside the existing `documentsByTopicId` block):

```typescript
import { getQuestionBank } from "@/lib/supabase/question-bank";
import {
  verifyQuestionAction,
  updateQuestionAction,
  regenerateQuestionBankAction,
} from "@/app/actions/subjects";

// In the page component, alongside existing Promise.all fetches:
const questionBanksByTopic = await Promise.all(
  topicsBySubject.flat().map((t) => getQuestionBank(t.id))
);
const questionBanksByTopicId = new Map(
  topicsBySubject.flat().map((t, i) => [t.id, questionBanksByTopic[i]])
);
```

- [ ] **Step 3: Add the question bank panel inside each topic's `<details>` block**

In the existing topic `<details>`, after the closing of the reference documents `<details>`, add:

```tsx
<details className="mt-2 rounded-lg border border-border bg-surface px-3 py-2">
  <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
    Question Bank ({(questionBanksByTopicId.get(topic.id) ?? []).length} / 10)
    {(questionBanksByTopicId.get(topic.id) ?? []).length > 0 &&
      (questionBanksByTopicId.get(topic.id) ?? []).every((q) => q.verified) && (
        <span className="text-success">· all verified</span>
      )}
  </summary>

  <div className="mt-2 flex flex-col gap-1">
    <form action={regenerateQuestionBankAction} className="mb-2">
      <input type="hidden" name="topicId" value={topic.id} />
      <button type="submit" className="text-xs text-primary hover:underline">
        Regenerate all 10 questions
      </button>
    </form>

    {(questionBanksByTopicId.get(topic.id) ?? []).length === 0 && (
      <p className="text-[11px] text-muted">
        No bank yet — questions generate automatically when the topic is created, or click Regenerate.
      </p>
    )}

    {(questionBanksByTopicId.get(topic.id) ?? []).map((q, qi) => (
      <details
        key={q.id}
        className="rounded-lg border border-border bg-background px-3 py-2"
      >
        <summary className="flex cursor-pointer items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${q.verified ? "bg-success" : "bg-muted"}`}
          />
          <span className="font-medium">
            Q{qi + 1} · §{(q.section_index ?? 0) + 1} · {q.format?.type ?? "extended"}
          </span>
          <span className="truncate text-muted">{q.prompt.slice(0, 55)}…</span>
        </summary>

        <div className="mt-3 flex flex-col gap-3 pl-1">
          <form action={updateQuestionAction} className="flex flex-col gap-2">
            <input type="hidden" name="questionId" value={q.id} />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">Question prompt</label>
              <textarea
                name="prompt"
                rows={3}
                defaultValue={q.prompt}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">Model answer</label>
              <textarea
                name="modelAnswer"
                rows={2}
                defaultValue={q.model_answer}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
              Save edits
            </Button>
          </form>

          {q.verified ? (
            <p className="text-xs font-medium text-success">✓ Verified</p>
          ) : (
            <form action={verifyQuestionAction}>
              <input type="hidden" name="questionId" value={q.id} />
              <Button type="submit" size="compact" className="self-start">
                Mark as verified ✓
              </Button>
            </form>
          )}
        </div>
      </details>
    ))}
  </div>
</details>
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/subjects.ts app/admin/subjects/page.tsx
git commit -m "feat: teacher question bank review, edit, and verify UI"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| 10 questions per lesson, tagged to sections | Task 2, 3 |
| Weighted distribution (3-3-4 etc.) | Task 2 `distributeQuestions` |
| Questions ordered by section (early sections first) | Task 2 sort + `bankPosition` |
| 4 first-attempt-correct mastery exit | Task 5 `submitBankedAnswerAction` |
| Wrong questions re-queued for retry | Task 5 retry queue logic |
| Question images (AI prompt → generated URL) | Task 2 (image field), Task 4 (finalization) |
| Question image displayed in practice UI | Task 5 (page.tsx) |
| Post-lesson interactive clarification for wrong quick checks | Task 7 |
| `step-reveal` component | Task 6 |
| `fill-gap` component | Task 6 |
| `sort-order` component | Task 6 |
| `match-connect` component | Task 6 |
| Clarification uses Brilliant-principle (student actively builds answer) | Task 6, 7 |
| Existing adaptive next-section tweak preserved | Not touched — `requestAdaptation` unchanged |
| Teacher can view all 10 questions | Task 8 |
| Teacher can edit prompt + model answer | Task 8 `updateQuestionAction` |
| Teacher can verify a question | Task 8 `verifyQuestionAction` |
| Teacher can regenerate the entire bank | Task 8 `regenerateQuestionBankAction` |
| DB migration (columns + tables) | Task 1 |

### Placeholder scan

No TBDs, TODOs, or vague "handle edge cases" language found.

### Type consistency

- `BankedQuestion` defined Task 2, consumed Tasks 3, 4, 8 ✓
- `SectionClarification` / `InteractiveContent` defined Task 7, consumed `clarification-player.tsx` ✓
- `Question` type updated Task 3, all five `.select()` calls in `questions.ts` updated ✓
- `distributeQuestions` defined + tested Task 2 ✓
- `createQuestionBank` / `getQuestionBank` defined Task 3, consumed Tasks 4, 8 ✓
- `createQuestionSession` / `recordSessionAttempt` / `completeSession` defined Task 3, consumed Task 5 ✓
- `uploadFile` signature is `{ bytes, filename, contentType }` → Task 4 uses `generateLessonImage` (which calls `uploadFile` internally) — no direct `uploadFile` call in `question-finalize.ts` ✓
- `generateLessonImage(prompt, topicId): Promise<string | null>` — Task 4 matches ✓
