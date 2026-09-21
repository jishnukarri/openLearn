"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import { createAssignment, copyAssignments } from "@/lib/supabase/assignments";
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

export async function assignTopicAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const classId = formData.get("classId");
  const topicId = formData.get("topicId");
  const notes = formData.get("notes");
  if (typeof classId !== "string" || typeof topicId !== "string") {
    throw new Error("Missing classId or topicId.");
  }

  await assertOwnsClass(profile.id, classId);

  await createAssignment({
    classId,
    topicId,
    assignedBy: profile.id,
    notes: typeof notes === "string" ? notes : undefined,
  });
  revalidatePath("/teacher/classes");
}

// Assigns any number of subtopics (picked across any number of topics, via
// the checkbox tree on /teacher/classes) to one class in a single submit —
// one assignments row per selected subtopic.
export async function assignSubtopicsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const classId = formData.get("classId");
  const subtopicIds = formData.getAll("subtopicIds").filter((v): v is string => typeof v === "string");
  const notes = formData.get("notes");
  if (typeof classId !== "string") throw new Error("Missing classId.");
  if (subtopicIds.length === 0) throw new Error("Pick at least one subtopic to assign.");

  await assertOwnsClass(profile.id, classId);

  for (const subtopicId of subtopicIds) {
    await createAssignment({
      classId,
      subtopicId,
      assignedBy: profile.id,
      notes: typeof notes === "string" ? notes : undefined,
    });
  }
  revalidatePath("/teacher/classes");
}

export async function copyAssignmentsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const sourceClassId = formData.get("sourceClassId");
  const targetClassId = formData.get("targetClassId");
  if (typeof sourceClassId !== "string" || typeof targetClassId !== "string") {
    throw new Error("Missing sourceClassId or targetClassId.");
  }
  if (sourceClassId === targetClassId) {
    throw new Error("Pick a different class to copy into.");
  }

  await assertOwnsClass(profile.id, sourceClassId);
  await assertOwnsClass(profile.id, targetClassId);

  await copyAssignments({ sourceClassId, targetClassId, assignedBy: profile.id });
  revalidatePath("/teacher/classes");
}
