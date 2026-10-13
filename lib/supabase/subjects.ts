import "server-only";
import { db } from "./database-client";

export type ExamBoard = { id: string; name: string };

export type SubjectArchetype =
  | "dynamic_causal"
  | "decision_incentive"
  | "spatial_pattern"
  | "procedural_structural"
  | "sequential_process";

export type Subject = {
  id: string;
  name: string;
  status: "draft" | "published";
  created_at: string;
  created_by: string;
  custom_instructions: string | null;
  archetype: SubjectArchetype | null;
  exam_boards: ExamBoard[];
};

const SUBJECT_COLUMNS =
  "id, name, status, created_at, created_by, custom_instructions, archetype, subject_exam_boards(exam_boards(id, name))";

// PostgREST returns an embedded relation as an object or an array depending
// on how it is joined, so accept both and flatten.
type EmbeddedBoards = { exam_boards: ExamBoard | ExamBoard[] }[];
const flattenBoards = (rows: EmbeddedBoards): ExamBoard[] =>
  rows.flatMap((row) => ([] as ExamBoard[]).concat(row.exam_boards));

type SubjectRow = Omit<Subject, "exam_boards"> & { subject_exam_boards: EmbeddedBoards };

function mapSubject(data: SubjectRow): Subject {
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    created_at: data.created_at,
    created_by: data.created_by,
    custom_instructions: data.custom_instructions,
    archetype: data.archetype ?? null,
    exam_boards: flattenBoards(data.subject_exam_boards),
  };
}

export async function listExamBoards(): Promise<ExamBoard[]> {
  const { data, error } = await db
    .from("exam_boards")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createExamBoard(name: string): Promise<ExamBoard> {
  const { data, error } = await db
    .from("exam_boards")
    .insert({ name })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

export type SubjectSummary = {
  id: string;
  name: string;
  status: "draft" | "published";
  created_at: string;
  created_by: string;
  exam_boards: ExamBoard[];
  topicCount: number;
};

type SummaryRow = Pick<Subject, "id" | "name" | "status" | "created_at" | "created_by"> & {
  subject_exam_boards: EmbeddedBoards;
  topics: { id: string }[];
};

function mapSummary(d: SummaryRow): SubjectSummary {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    created_at: d.created_at,
    created_by: d.created_by,
    exam_boards: flattenBoards(d.subject_exam_boards),
    topicCount: d.topics.length,
  };
}

export async function listSubjectSummaries(): Promise<SubjectSummary[]> {
  const { data, error } = await db
    .from("subjects")
    .select("id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as SummaryRow[]).map(mapSummary);
}

// Same shape as listSubjectSummaries, scoped to subjects a specific teacher
// owns — powers /teacher/subjects, which must never show admin-owned or
// other teachers' subjects.
export async function listSubjectSummariesByOwner(ownerId: string): Promise<SubjectSummary[]> {
  const { data, error } = await db
    .from("subjects")
    .select("id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id)")
    .eq("created_by", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as SummaryRow[]).map(mapSummary);
}

export async function listSubjects(): Promise<Subject[]> {
  const { data, error } = await db
    .from("subjects")
    .select(SUBJECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as SubjectRow[]).map(mapSubject);
}

export async function getSubject(subjectId: string): Promise<Subject | null> {
  const { data, error } = await db
    .from("subjects")
    .select(SUBJECT_COLUMNS)
    .eq("id", subjectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapSubject(data as unknown as SubjectRow);
}

export async function listPublishedSubjects(): Promise<Subject[]> {
  const subjects = await listSubjects();
  return subjects.filter((s) => s.status === "published");
}

export async function updateSpecText(
  subjectId: string,
  examBoardId: string,
  specText: string
): Promise<void> {
  const { error } = await db
    .from("subject_exam_boards")
    .update({ spec_text: specText })
    .eq("subject_id", subjectId)
    .eq("exam_board_id", examBoardId);
  if (error) throw error;
}

export async function updateSubjectArchetype(
  subjectId: string,
  archetype: SubjectArchetype | null
): Promise<void> {
  const { error } = await db
    .from("subjects")
    .update({ archetype })
    .eq("id", subjectId);
  if (error) throw error;
}

export async function updateSubjectName(
  subjectId: string,
  name: string
): Promise<void> {
  const { error } = await db
    .from("subjects")
    .update({ name })
    .eq("id", subjectId);
  if (error) throw error;
}

export async function updateSubjectInstructions(
  subjectId: string,
  instructions: string
): Promise<void> {
  const { error } = await db
    .from("subjects")
    .update({ custom_instructions: instructions })
    .eq("id", subjectId);
  if (error) throw error;
}

// Concatenates whatever spec text has been pasted in across this subject's
// exam boards, for grounding topic generation. Empty string if none yet.
export async function getSpecTextForSubject(subjectId: string): Promise<string> {
  const { data, error } = await db
    .from("subject_exam_boards")
    .select("spec_text, exam_boards(name)")
    .eq("subject_id", subjectId);
  if (error) throw error;

  return (data as unknown as { spec_text: string | null; exam_boards: { name: string } }[])
    .filter((row) => row.spec_text)
    .map((row) => `[${row.exam_boards.name}]\n${row.spec_text}`)
    .join("\n\n");
}

export async function getSpecTextForBoard(
  subjectId: string,
  examBoardId: string
): Promise<string> {
  const { data, error } = await db
    .from("subject_exam_boards")
    .select("spec_text")
    .eq("subject_id", subjectId)
    .eq("exam_board_id", examBoardId)
    .maybeSingle();
  if (error) throw error;
  return (data as { spec_text?: string | null } | null)?.spec_text ?? "";
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const { error } = await db.from("subjects").delete().eq("id", subjectId);
  if (error) throw error;
}

export async function publishSubject(subjectId: string): Promise<void> {
  const { error } = await db
    .from("subjects")
    .update({ status: "published" })
    .eq("id", subjectId);
  if (error) throw error;
}

// Doesn't touch topic/subtopic publish status — those stay as they were,
// so republishing the subject later brings everything straight back
// exactly as it was left, no re-publishing each topic by hand.
export async function unpublishSubject(subjectId: string): Promise<void> {
  const { error } = await db
    .from("subjects")
    .update({ status: "draft" })
    .eq("id", subjectId);
  if (error) throw error;
}

export async function createSubject(input: {
  name: string;
  createdBy: string;
  examBoardIds: string[];
}): Promise<Subject> {

  const { data: subject, error: subjectError } = await db
    .from("subjects")
    .insert({ name: input.name, created_by: input.createdBy })
    .select("id, name, status, created_at, created_by, custom_instructions")
    .single();

  if (subjectError) throw subjectError;

  if (input.examBoardIds.length > 0) {
    const { error: boardsError } = await db
      .from("subject_exam_boards")
      .insert(
        input.examBoardIds.map((examBoardId) => ({
          subject_id: subject.id,
          exam_board_id: examBoardId,
        }))
      );
    if (boardsError) throw boardsError;
  }

  return { ...subject, archetype: null, exam_boards: [] };
}
