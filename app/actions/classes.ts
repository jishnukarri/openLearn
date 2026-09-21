"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import { createClass, deleteClass, removeStudentFromClass } from "@/lib/supabase/classes";

const CreateClassSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters.").trim(),
});

export async function createClassAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");

  const validated = CreateClassSchema.safeParse({ name: formData.get("name") });
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message ?? "Invalid input.");
  }

  await createClass({ name: validated.data.name, teacherId: profile.id });
  revalidatePath("/teacher/classes");
}

export async function deleteClassAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const classId = formData.get("classId");
  if (typeof classId !== "string") throw new Error("Missing classId.");

  await deleteClass({ classId, teacherId: profile.id });
  revalidatePath("/teacher/classes");
}

export async function removeStudentAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const classId = formData.get("classId");
  const studentId = formData.get("studentId");
  if (typeof classId !== "string" || typeof studentId !== "string")
    throw new Error("Missing classId or studentId.");

  await removeStudentFromClass({ classId, studentId, teacherId: profile.id });
  revalidatePath("/teacher/classes");
}
