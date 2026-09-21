import "server-only";
import { createServiceClient } from "./server";

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

function mapSubject(data: any): Subject {
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    created_at: data.created_at,
    created_by: data.created_by,
    custom_instructions: data.custom_instructions,
    archetype: data.archetype ?? null,
    exam_boards: data.subject_exam_boards.flatMap(
      (row: { exam_boards: ExamBoard[] }) => row.exam_boards
    ),
  };
}

export async function listExamBoards(): Promise<ExamBoard[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("exam_boards")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createExamBoard(name: string): Promise<ExamBoard> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
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

export async function listSubjectSummaries(): Promise<SubjectSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any[]).map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    created_at: d.created_at,
    created_by: d.created_by,
    exam_boards: d.subject_exam_boards.flatMap((row: any) => row.exam_boards),
    topicCount: (d.topics as any[]).length,
  }));
}

// Same shape as listSubjectSummaries, scoped to subjects a specific teacher
// owns — powers /teacher/subjects, which must never show admin-owned or
// other teachers' subjects.
export async function listSubjectSummariesByOwner(ownerId: string): Promise<SubjectSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id)")
    .eq("created_by", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any[]).map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    created_at: d.created_at,
    created_by: d.created_by,
    exam_boards: d.subject_exam_boards.flatMap((row: any) => row.exam_boards),
    topicCount: (d.topics as any[]).length,
  }));
}

export async function listSubjects(): Promise<Subject[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select(SUBJECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(mapSubject);
}

export async function getSubject(subjectId: string): Promise<Subject | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select(SUBJECT_COLUMNS)
    .eq("id", subjectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapSubject(data);
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
  const supabase = createServiceClient();
  const { error } = await supabase
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
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subjects")
    .update({ archetype })
    .eq("id", subjectId);
  if (error) throw error;
}

export async function updateSubjectInstructions(
  subjectId: string,
  instructions: string
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subjects")
    .update({ custom_instructions: instructions })
    .eq("id", subjectId);
  if (error) throw error;
}

// Concatenates whatever spec text has been pasted in across this subject's
// exam boards, for grounding topic generation. Empty string if none yet.
export async function getSpecTextForSubject(subjectId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subject_exam_boards")
    .select("spec_text, exam_boards(name)")
    .eq("subject_id", subjectId);
  if (error) throw error;

  return (data as any[])
    .filter((row) => row.spec_text)
    .map((row) => `[${row.exam_boards.name}]\n${row.spec_text}`)
    .join("\n\n");
}

export async function getSpecTextForBoard(
  subjectId: string,
  examBoardId: string
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subject_exam_boards")
    .select("spec_text")
    .eq("subject_id", subjectId)
    .eq("exam_board_id", examBoardId)
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.spec_text ?? "";
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) throw error;
}

export async function publishSubject(subjectId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subjects")
    .update({ status: "published" })
    .eq("id", subjectId);
  if (error) throw error;
}

// Doesn't touch topic/subtopic publish status — those stay as they were,
// so republishing the subject later brings everything straight back
// exactly as it was left, no re-publishing each topic by hand.
export async function unpublishSubject(subjectId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
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
  const supabase = createServiceClient();

  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .insert({ name: input.name, created_by: input.createdBy })
    .select("id, name, status, created_at, created_by, custom_instructions")
    .single();

  if (subjectError) throw subjectError;

  if (input.examBoardIds.length > 0) {
    const { error: boardsError } = await supabase
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
