import "server-only";
import { db, type DatabaseClient } from "./database-client";

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
  const { data, error } = await db
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
  const { error: deleteError } = await db
    .from("paper_questions")
    .delete()
    .eq("paper_id", paperId);
  if (deleteError) throw deleteError;

  if (questions.length === 0) return;

  const { error } = await db.from("paper_questions").insert(
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
  const { data, error } = await db
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
  const { data, error } = await db
    .from("paper_questions")
    .select("id, paper_id, question_number, prompt, max_marks, markscheme, image_url")
    .eq("paper_id", paperId)
    .order("question_number");
  if (error) throw error;
  type QuestionRow = {
    id: string;
    paper_id: string;
    question_number: number;
    prompt: string;
    max_marks: number;
    markscheme: PaperQuestion["markscheme"];
    image_url: string | null;
  };
  return (data as unknown as QuestionRow[]).map((r) => ({
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
  const { error } = await db.from("papers").update({ status: "ready" }).eq("id", paperId);
  if (error) throw error;
}

export async function listPapersForTeacher(teacherId: string): Promise<Paper[]> {
  const { data, error } = await db
    .from("papers")
    .select("id, teacher_id, class_id, title, status, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type PaperRow = {
    id: string;
    teacher_id: string;
    class_id: string;
    title: string;
    status: Paper["status"];
    created_at: string;
  };
  return (data as unknown as PaperRow[]).map((d) => ({
    id: d.id,
    teacherId: d.teacher_id,
    classId: d.class_id,
    title: d.title,
    status: d.status,
    createdAt: d.created_at,
  }));
}

export type RosterEntry = {
  id: string;
  paperId: string;
  studentId: string | null;
  customName: string | null;
  referenceCode: string;
};

// Same unambiguous alphabet as class invite codes (lib/db/classes.ts)
// — read aloud/hand-written by students, so no 0/O/1/I confusion.
function generateReferenceCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function insertRosterEntry(
  db: DatabaseClient,
  row: { paper_id: string; student_id: string | null; custom_name: string | null }
): Promise<RosterEntry> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("paper_roster_entries")
      .insert({ ...row, reference_code: generateReferenceCode() })
      .select("id, paper_id, student_id, custom_name, reference_code")
      .single();
    if (!error) {
      return {
        id: data.id,
        paperId: data.paper_id,
        studentId: data.student_id,
        customName: data.custom_name,
        referenceCode: data.reference_code,
      };
    }
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique reference code, try again.");
}

// Sequential (not Promise.all) deliberately — each insert needs prior
// collisions resolved before generating the next code; class-sized
// batches make the latency cost negligible.
export async function addPlatformStudentsToRoster(
  paperId: string,
  studentIds: string[]
): Promise<RosterEntry[]> {
  const results: RosterEntry[] = [];
  for (const studentId of studentIds) {
    results.push(
      await insertRosterEntry(db, { paper_id: paperId, student_id: studentId, custom_name: null })
    );
  }
  return results;
}

export async function addCustomStudentsToRoster(
  paperId: string,
  names: string[]
): Promise<RosterEntry[]> {
  const results: RosterEntry[] = [];
  for (const name of names) {
    results.push(
      await insertRosterEntry(db, { paper_id: paperId, student_id: null, custom_name: name })
    );
  }
  return results;
}

export async function getRosterForPaper(paperId: string): Promise<
  Array<RosterEntry & { displayName: string; email: string | null }>
> {
  const { data, error } = await db
    .from("paper_roster_entries")
    .select("id, paper_id, student_id, custom_name, reference_code, profiles(full_name, email)")
    .eq("paper_id", paperId)
    .order("created_at");
  if (error) throw error;
  type RosterRow = {
    id: string;
    paper_id: string;
    student_id: string | null;
    custom_name: string | null;
    reference_code: string;
    profiles: { full_name: string | null; email: string | null } | null;
  };
  return (data as unknown as RosterRow[]).map((r) => ({
    id: r.id,
    paperId: r.paper_id,
    studentId: r.student_id,
    customName: r.custom_name,
    referenceCode: r.reference_code,
    displayName: r.custom_name ?? r.profiles?.full_name ?? r.profiles?.email ?? "Unknown",
    email: r.profiles?.email ?? null,
  }));
}

export async function removeRosterEntry(entryId: string): Promise<void> {
  const { error } = await db.from("paper_roster_entries").delete().eq("id", entryId);
  if (error) throw error;
}
