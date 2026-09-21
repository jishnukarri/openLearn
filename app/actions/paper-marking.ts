"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions, getRosterForPaper } from "@/lib/supabase/papers";
import {
  createSubmission,
  saveSubmissionAnswers,
  updateSubmissionStatus,
  reassignSubmissionRoster,
  getSubmission,
  getSubmissionsForPaper,
} from "@/lib/supabase/paper-submissions";
import { detectReferenceCode, markSubmissionAgainstPaper } from "@/lib/ai/paper-marking";
import { uploadFile, downloadFileBytes } from "@/lib/appwrite/storage";
import { groupFilesByReferenceCode } from "@/lib/paper-marking-grouping";
import { pdfToImages } from "@/lib/pdf-to-images";
import type { PaperQuestion } from "@/lib/supabase/papers";

type RawFile = { bytes: Buffer; contentType: string; filename: string };

async function assertOwnsPaper(paperId: string, teacherId: string) {
  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== teacherId) throw new Error("Paper not found.");
  return paper;
}

// Splits a PDF into one RawFile per page. A student answer-script upload is
// often a single PDF with every student's pages concatenated together, and
// the reference-code grouping below (groupFilesByReferenceCode) needs one
// unit per page — the page carrying a code starts a new student, and every
// following code-less page belongs to that same student until the next
// code (or the end of the batch). Treating the whole PDF as one unit would
// only ever detect the first page's code and lump every student together.
async function pdfToRawFiles(bytes: Buffer, filename: string): Promise<RawFile[]> {
  const pages = await pdfToImages(bytes);
  return pages.map((p, i) => ({ ...p, filename: `${filename} (page ${i + 1})` }));
}

// Expands any .zip uploads into their contained files (zip entries in the
// order JSZip reports them), and every PDF (top-level or inside a zip) into
// one file per page. Every other file passes through unchanged.
async function expandFiles(files: File[]): Promise<RawFile[]> {
  const JSZip = (await import("jszip")).default;
  const result: RawFile[] = [];

  for (const file of files) {
    const isZip = file.type === "application/zip" || file.name.toLowerCase().endsWith(".zip");
    if (!isZip) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        result.push(...(await pdfToRawFiles(bytes, file.name)));
      } else {
        result.push({ bytes, contentType: file.type || "application/octet-stream", filename: file.name });
      }
      continue;
    }

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    for (const entry of entries) {
      const bytes = Buffer.from(await entry.async("nodebuffer"));
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".pdf")) {
        result.push(...(await pdfToRawFiles(bytes, entry.name)));
        continue;
      }
      const contentType = lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
          ? "image/jpeg"
          : "application/octet-stream";
      result.push({ bytes, contentType, filename: entry.name });
    }
  }

  return result;
}

// Marks one submission and persists the result, matching/error status —
// shared by the bulk "mark pending" pass and the manual-reassignment retry.
async function markOneSubmission(
  submissionId: string,
  questions: PaperQuestion[],
  maxMarksByQuestion: Map<number, number>,
  images: { bytes: Buffer; contentType: string }[]
): Promise<void> {
  try {
    const results = await markSubmissionAgainstPaper({ questions, images });
    await saveSubmissionAnswers(submissionId, results, maxMarksByQuestion);
    const totalAwarded = results.reduce((sum, r) => sum + r.marksAwarded, 0);
    const totalPossible = results.reduce((sum, r) => sum + (maxMarksByQuestion.get(r.questionNumber) ?? 0), 0);
    await updateSubmissionStatus(submissionId, {
      status: "marked",
      totalMarksAwarded: totalAwarded,
      totalPossibleMarks: totalPossible,
    });
  } catch (err) {
    await updateSubmissionStatus(submissionId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Marking failed.",
    });
  }
}

// Splits the uploaded batch by detected reference code and stores each
// student's script as its own submission ("pending" if matched to a roster
// entry, "unmatched" if not) — but does NOT mark anything yet. The teacher
// reviews the split on the results page (reassigning any unmatched ones)
// and explicitly kicks off marking with markPendingSubmissionsAction, so a
// bad split never wastes an AI marking pass.
export async function markSubmissionsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  if (typeof paperId !== "string") throw new Error("Missing paperId.");

  const paper = await assertOwnsPaper(paperId, profile.id);
  if (paper.status !== "ready") throw new Error("Finish reviewing this paper before marking submissions.");

  const uploaded = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (uploaded.length === 0) throw new Error("Upload at least one file.");

  const roster = await getRosterForPaper(paperId);
  if (roster.length === 0) throw new Error("Add students to the roster before marking submissions.");

  const rosterByCode = new Map(roster.map((r) => [r.referenceCode, r.id]));

  const files = await expandFiles(uploaded);
  const codes: (string | null)[] = [];
  for (const file of files) {
    codes.push(await detectReferenceCode([{ bytes: file.bytes, contentType: file.contentType }]));
  }

  const groups = groupFilesByReferenceCode(codes, rosterByCode);

  for (const group of groups) {
    const groupFiles = group.fileIndices.map((i) => files[i]);
    const imageFileIds = await Promise.all(
      groupFiles.map((f) => uploadFile({ bytes: f.bytes, filename: f.filename, contentType: f.contentType }))
    );

    await createSubmission({
      paperId,
      rosterEntryId: group.rosterEntryId,
      detectedReferenceCode: group.detectedCode,
      status: group.rosterEntryId ? "pending" : "unmatched",
      imageFileIds,
    });
  }

  redirect(`/teacher/papers/${paperId}/results`);
}

// Marks every still-"pending" submission for this paper — the step the
// teacher triggers explicitly after reviewing the split on the results
// page. Each submission is marked and persisted independently, so one
// failure doesn't block the rest.
export async function markPendingSubmissionsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  if (typeof paperId !== "string") throw new Error("Missing paperId.");

  await assertOwnsPaper(paperId, profile.id);

  const [questions, submissions] = await Promise.all([
    getPaperQuestions(paperId),
    getSubmissionsForPaper(paperId),
  ]);
  const maxMarksByQuestion = new Map(questions.map((q) => [q.questionNumber, q.maxMarks]));
  const pending = submissions.filter((s) => s.status === "pending");

  for (const submission of pending) {
    const images = await Promise.all(submission.imageFileIds.map((id) => downloadFileBytes(id)));
    await markOneSubmission(submission.id, questions, maxMarksByQuestion, images);
  }

  redirect(`/teacher/papers/${paperId}/results`);
}

// Manually links an "unmatched" submission to a roster entry (the AI
// couldn't read a code, or read one that didn't match anyone), then marks
// it the same way a matched submission would once the teacher confirms it.
export async function reassignSubmissionAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const paperId = formData.get("paperId");
  const submissionId = formData.get("submissionId");
  const rosterEntryId = formData.get("rosterEntryId");
  if (
    typeof paperId !== "string" ||
    typeof submissionId !== "string" ||
    typeof rosterEntryId !== "string"
  ) {
    throw new Error("Missing paperId, submissionId, or rosterEntryId.");
  }

  await assertOwnsPaper(paperId, profile.id);

  const submission = await getSubmission(submissionId);
  if (!submission || submission.paperId !== paperId) throw new Error("Submission not found.");

  await reassignSubmissionRoster(submissionId, rosterEntryId);

  const questions = await getPaperQuestions(paperId);
  const maxMarksByQuestion = new Map(questions.map((q) => [q.questionNumber, q.maxMarks]));
  const images = await Promise.all(submission.imageFileIds.map((id) => downloadFileBytes(id)));
  await markOneSubmission(submissionId, questions, maxMarksByQuestion, images);

  redirect(`/teacher/papers/${paperId}/results`);
}
