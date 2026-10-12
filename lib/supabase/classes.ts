import "server-only";
import { db } from "./database-client";

export type Class = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  member_count: number;
};

function generateInviteCode(): string {
  // Unambiguous alphabet (no 0/O/1/I) — this gets read aloud/typed by hand.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function listClassesByTeacher(teacherId: string): Promise<Class[]> {
  const { data, error } = await db
    .from("classes")
    .select("id, name, invite_code, created_at, class_members(count)")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  type Row = { id: string; name: string; invite_code: string; created_at: string; class_members: { count: number }[] };
  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    invite_code: row.invite_code,
    created_at: row.created_at,
    member_count: row.class_members[0]?.count ?? 0,
  }));
}

export async function createClass(input: {
  name: string;
  teacherId: string;
}): Promise<Class> {

  // invite_code is unique — retry on the rare collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("classes")
      .insert({
        name: input.name,
        teacher_id: input.teacherId,
        invite_code: generateInviteCode(),
      })
      .select("id, name, invite_code, created_at")
      .single();

    if (!error) return { ...data, member_count: 0 };
    if (error.code !== "23505") throw error; // not a unique-violation, bail
  }

  throw new Error("Could not generate a unique invite code, try again.");
}

export async function getClassByInviteCode(
  inviteCode: string
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await db
    .from("classes")
    .select("id, name")
    .eq("invite_code", inviteCode.toUpperCase())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function joinClass(input: {
  classId: string;
  studentId: string;
}): Promise<void> {
  const { error } = await db
    .from("class_members")
    .upsert(
      { class_id: input.classId, student_id: input.studentId },
      { onConflict: "class_id,student_id" }
    );
  if (error) throw error;
}

export async function getStudentClasses(
  studentId: string
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db
    .from("class_members")
    .select("classes(id, name)")
    .eq("student_id", studentId);

  if (error) throw error;
  return (data as unknown as { classes: { id: string; name: string } }[]).flatMap((row) => row.classes);
}

export type ClassMember = {
  profileId: string;
  fullName: string | null;
  email: string;
  joinedAt: string;
};

export async function listClassMembers(
  classId: string,
  teacherId: string
): Promise<ClassMember[]> {
  // Verify the class belongs to this teacher before exposing student data.
  const { data: cls } = await db
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!cls) return [];

  const { data, error } = await db
    .from("class_members")
    .select("joined_at, profiles(id, full_name, email)")
    .eq("class_id", classId)
    .order("joined_at");
  if (error) throw error;

  type MemberRow = { joined_at: string; profiles: { id: string; full_name: string | null; email: string } };
  return (data as unknown as MemberRow[]).map((row) => ({
    profileId: row.profiles.id,
    fullName: row.profiles.full_name,
    email: row.profiles.email,
    joinedAt: row.joined_at,
  }));
}

export async function removeStudentFromClass(input: {
  classId: string;
  studentId: string;
  teacherId: string;
}): Promise<void> {
  const { data: cls } = await db
    .from("classes")
    .select("id")
    .eq("id", input.classId)
    .eq("teacher_id", input.teacherId)
    .maybeSingle();
  if (!cls) throw new Error("Class not found.");

  const { error } = await db
    .from("class_members")
    .delete()
    .eq("class_id", input.classId)
    .eq("student_id", input.studentId);
  if (error) throw error;
}

export async function deleteClass(input: {
  classId: string;
  teacherId: string;
}): Promise<void> {
  const { error } = await db
    .from("classes")
    .delete()
    .eq("id", input.classId)
    .eq("teacher_id", input.teacherId);

  if (error) throw error;
}
