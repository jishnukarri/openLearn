import "server-only";
import { db } from "./database-client";
import type { SubmissionQuestionResult } from "@/lib/ai/paper-marking";

export type SubmissionStatus = "pending" | "marked" | "unmatched" | "error";

export type Submission = {
  id: string;
  paperId: string;
  rosterEntryId: string | null;
  detectedReferenceCode: string | null;
  status: SubmissionStatus;
  errorMessage: string | null;
  imageFileIds: string[];
  totalMarksAwarded: number | null;
  totalPossibleMarks: number | null;
  createdAt: string;
};

export type SubmissionAnswer = {
  id: string;
  submissionId: string;
  questionNumber: number;
  marksAwarded: number;
  maxMarks: number;
  feedback: { point: string; met: boolean; comment: string }[];
};

type SubmissionRow = {
  id: string;
  paper_id: string;
  roster_entry_id: string | null;
  detected_reference_code: string | null;
  status: SubmissionStatus;
  error_message: string | null;
  image_file_ids: string[] | null;
  total_marks_awarded: number | null;
  total_possible_marks: number | null;
  created_at: string;
};

function mapSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    paperId: r.paper_id,
    rosterEntryId: r.roster_entry_id,
    detectedReferenceCode: r.detected_reference_code,
    status: r.status,
    errorMessage: r.error_message,
    imageFileIds: r.image_file_ids ?? [],
    totalMarksAwarded: r.total_marks_awarded,
    totalPossibleMarks: r.total_possible_marks,
    createdAt: r.created_at,
  };
}

export async function createSubmission(input: {
  paperId: string;
  rosterEntryId: string | null;
  detectedReferenceCode: string | null;
  status: SubmissionStatus;
  imageFileIds: string[];
}): Promise<string> {
  const { data, error } = await db
    .from("paper_submissions")
    .insert({
      paper_id: input.paperId,
      roster_entry_id: input.rosterEntryId,
      detected_reference_code: input.detectedReferenceCode,
      status: input.status,
      image_file_ids: input.imageFileIds,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveSubmissionAnswers(
  submissionId: string,
  results: SubmissionQuestionResult[],
  maxMarksByQuestion: Map<number, number>
): Promise<void> {
  if (results.length === 0) return;
  const { error } = await db.from("paper_submission_answers").insert(
    results.map((r) => ({
      submission_id: submissionId,
      question_number: r.questionNumber,
      marks_awarded: r.marksAwarded,
      max_marks: maxMarksByQuestion.get(r.questionNumber) ?? 0,
      feedback: r.feedback,
    }))
  );
  if (error) throw error;
}

export async function updateSubmissionStatus(
  submissionId: string,
  update: {
    status: SubmissionStatus;
    errorMessage?: string;
    totalMarksAwarded?: number;
    totalPossibleMarks?: number;
  }
): Promise<void> {
  const { error } = await db
    .from("paper_submissions")
    .update({
      status: update.status,
      error_message: update.errorMessage ?? null,
      total_marks_awarded: update.totalMarksAwarded ?? null,
      total_possible_marks: update.totalPossibleMarks ?? null,
    })
    .eq("id", submissionId);
  if (error) throw error;
}

export async function reassignSubmissionRoster(submissionId: string, rosterEntryId: string): Promise<void> {
  const { error } = await db
    .from("paper_submissions")
    .update({ roster_entry_id: rosterEntryId })
    .eq("id", submissionId);
  if (error) throw error;
}

export async function getSubmissionsForPaper(paperId: string): Promise<
  Array<Submission & { displayName: string | null }>
> {
  const { data, error } = await db
    .from("paper_submissions")
    .select(
      "id, paper_id, roster_entry_id, detected_reference_code, status, error_message, image_file_ids, total_marks_awarded, total_possible_marks, created_at, paper_roster_entries(custom_name, profiles(full_name, email))"
    )
    .eq("paper_id", paperId)
    .order("created_at");
  if (error) throw error;
  type SubmissionWithRosterRow = SubmissionRow & {
    paper_roster_entries: {
      custom_name: string | null;
      profiles: { full_name: string | null; email: string | null } | null;
    } | null;
  };
  return (data as unknown as SubmissionWithRosterRow[]).map((r) => {
    const roster = r.paper_roster_entries;
    const displayName = roster
      ? roster.custom_name ?? roster.profiles?.full_name ?? roster.profiles?.email ?? null
      : null;
    return { ...mapSubmission(r), displayName };
  });
}

export async function getSubmission(submissionId: string): Promise<Submission | null> {
  const { data, error } = await db
    .from("paper_submissions")
    .select(
      "id, paper_id, roster_entry_id, detected_reference_code, status, error_message, image_file_ids, total_marks_awarded, total_possible_marks, created_at"
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSubmission(data) : null;
}

export async function getSubmissionAnswers(submissionId: string): Promise<SubmissionAnswer[]> {
  const { data, error } = await db
    .from("paper_submission_answers")
    .select("id, submission_id, question_number, marks_awarded, max_marks, feedback")
    .eq("submission_id", submissionId)
    .order("question_number");
  if (error) throw error;
  type AnswerRow = {
    id: string;
    submission_id: string;
    question_number: number;
    marks_awarded: number;
    max_marks: number;
    feedback: SubmissionAnswer["feedback"];
  };
  return (data as unknown as AnswerRow[]).map((r) => ({
    id: r.id,
    submissionId: r.submission_id,
    questionNumber: r.question_number,
    marksAwarded: r.marks_awarded,
    maxMarks: r.max_marks,
    feedback: r.feedback,
  }));
}
