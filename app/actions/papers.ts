"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { extractPaperQuestions } from "@/lib/ai/paper-extraction";
import {
  createPaper,
  replacePaperQuestions,
  getPaper,
  markPaperReady,
  addPlatformStudentsToRoster,
  addCustomStudentsToRoster,
  removeRosterEntry,
} from "@/lib/supabase/papers";
import { db } from "@/lib/supabase/database-client";

async function assertOwnsClass(teacherId: string, classId: string) {
  const { data: cls, error } = await db
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

export async function addPlatformStudentsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  if (typeof paperId !== "string") throw new Error("Missing paperId.");

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  const studentIds = formData.getAll("studentIds").filter((v): v is string => typeof v === "string");
  if (studentIds.length === 0) throw new Error("Select at least one student.");

  await addPlatformStudentsToRoster(paperId, studentIds);
  revalidatePath(`/teacher/papers/${paperId}`);
}

export async function addCustomStudentsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  const namesRaw = formData.get("names");
  if (typeof paperId !== "string" || typeof namesRaw !== "string") {
    throw new Error("Missing paperId or names.");
  }

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  const names = namesRaw
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) throw new Error("Enter at least one student name.");

  await addCustomStudentsToRoster(paperId, names);
  revalidatePath(`/teacher/papers/${paperId}`);
}

export async function removeRosterEntryAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  const entryId = formData.get("entryId");
  if (typeof paperId !== "string" || typeof entryId !== "string") {
    throw new Error("Missing paperId or entryId.");
  }

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) throw new Error("Paper not found.");

  await removeRosterEntry(entryId);
  revalidatePath(`/teacher/papers/${paperId}`);
}
