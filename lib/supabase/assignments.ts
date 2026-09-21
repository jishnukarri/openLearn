import "server-only";
import { db } from "./database-client";

export type Assignment = {
  id: string;
  topic_id: string | null;
  topic_name: string;
  subtopic_id: string | null;
  subtopic_name: string | null;
  subject_name: string;
  class_name: string;
  notes: string | null;
  created_at: string;
};

// A row's target is either a whole topic (legacy) or a specific subtopic
// (current) — never both, always at least one (DB check constraint). This
// resolves either shape into the same flat display fields.
function resolveAssignmentTarget(row: any): {
  topic_id: string | null;
  topic_name: string;
  subtopic_id: string | null;
  subtopic_name: string | null;
  subject_name: string;
} {
  if (row.subtopics) {
    return {
      topic_id: null,
      topic_name: row.subtopics.topics.name,
      subtopic_id: row.subtopics.id,
      subtopic_name: row.subtopics.name,
      subject_name: row.subtopics.topics.subjects.name,
    };
  }
  return {
    topic_id: row.topics.id,
    topic_name: row.topics.name,
    subtopic_id: null,
    subtopic_name: null,
    subject_name: row.topics.subjects.name,
  };
}

export async function listAssignmentsForStudent(
  studentId: string
): Promise<Assignment[]> {

  const { data: memberships, error: memberError } = await db
    .from("class_members")
    .select("class_id")
    .eq("student_id", studentId);
  if (memberError) throw memberError;

  const classIds = memberships.map((m: any) => m.class_id);
  if (classIds.length === 0) return [];

  const { data, error } = await db
    .from("assignments")
    .select(
      "id, notes, created_at, topics(id, name, subjects(name)), subtopics(id, name, topics(name, subjects(name))), classes(name)"
    )
    .in("class_id", classIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data as any[]).map((row) => ({
    id: row.id,
    ...resolveAssignmentTarget(row),
    class_name: row.classes.name,
    notes: row.notes,
    created_at: row.created_at,
  }));
}

// The most recent assignment giving a student access to this topic that
// also carries a teacher customization note — the trigger for forking
// class-specific content (lib/class-content.ts). Self-study access, or an
// assignment with no note, returns null and the student gets the shared
// topic-wide content. Subtopic-only assignments never fork (out of scope —
// forking stays topic-scoped; a subtopic assignment simply doesn't
// contribute to a topic-level fork).
export async function getForkingAssignment(
  studentId: string,
  topicId: string
): Promise<{ classId: string; notes: string } | null> {

  const { data: memberships, error: memberError } = await db
    .from("class_members")
    .select("class_id")
    .eq("student_id", studentId);
  if (memberError) throw memberError;

  const classIds = memberships.map((m) => m.class_id);
  if (classIds.length === 0) return null;

  const { data, error } = await db
    .from("assignments")
    .select("class_id, notes")
    .eq("topic_id", topicId)
    .in("class_id", classIds)
    .not("notes", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.notes) return null;

  return { classId: data.class_id, notes: data.notes };
}

export async function createAssignment(input: {
  classId: string;
  topicId?: string;
  subtopicId?: string;
  assignedBy: string;
  notes?: string;
}): Promise<void> {
  if (!input.topicId && !input.subtopicId) {
    throw new Error("createAssignment requires a topicId or a subtopicId.");
  }
  const { error } = await db.from("assignments").insert({
    class_id: input.classId,
    topic_id: input.topicId ?? null,
    subtopic_id: input.subtopicId ?? null,
    assigned_by: input.assignedBy,
    notes: input.notes || null,
  });
  if (error) throw error;
}

export async function listAssignmentsForClass(classId: string): Promise<
  {
    id: string;
    topic_id: string | null;
    topic_name: string;
    subtopic_id: string | null;
    subtopic_name: string | null;
    notes: string | null;
    created_at: string;
  }[]
> {
  const { data, error } = await db
    .from("assignments")
    .select(
      "id, notes, created_at, topics(id, name, subjects(name)), subtopics(id, name, topics(name, subjects(name)))"
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data as any[]).map((row) => {
    const target = resolveAssignmentTarget(row);
    return {
      id: row.id,
      topic_id: target.topic_id,
      topic_name: target.topic_name,
      subtopic_id: target.subtopic_id,
      subtopic_name: target.subtopic_name,
      notes: row.notes,
      created_at: row.created_at,
    };
  });
}

// Copies every assignment from one of a teacher's classes into another.
// Dedupes against the target's existing assignments by whichever target
// (topic or subtopic) each row actually has — a plain topic_id Set would
// collapse every subtopic-only row onto the same null key.
function assignmentDedupeKey(row: { topic_id: string | null; subtopic_id: string | null }): string {
  return row.subtopic_id ? `s:${row.subtopic_id}` : `t:${row.topic_id}`;
}

export async function copyAssignments(input: {
  sourceClassId: string;
  targetClassId: string;
  assignedBy: string;
}): Promise<number> {

  const { data: source, error: sourceError } = await db
    .from("assignments")
    .select("topic_id, subtopic_id, notes")
    .eq("class_id", input.sourceClassId);
  if (sourceError) throw sourceError;
  if (source.length === 0) return 0;

  const { data: existing, error: existingError } = await db
    .from("assignments")
    .select("topic_id, subtopic_id")
    .eq("class_id", input.targetClassId);
  if (existingError) throw existingError;
  const alreadyAssigned = new Set(existing.map((r: any) => assignmentDedupeKey(r)));

  const rows = source
    .filter((r: any) => !alreadyAssigned.has(assignmentDedupeKey(r)))
    .map((r: any) => ({
      class_id: input.targetClassId,
      topic_id: r.topic_id,
      subtopic_id: r.subtopic_id,
      assigned_by: input.assignedBy,
      notes: r.notes,
    }));

  if (rows.length === 0) return 0;

  const { error } = await db.from("assignments").insert(rows);
  if (error) throw error;
  return rows.length;
}
