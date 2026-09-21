"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { copySubjectForTeacher } from "@/lib/supabase/subject-copy";

export async function copySubjectAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("teacher");
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");

  const newSubjectId = await copySubjectForTeacher(subjectId, profile.id);

  revalidatePath("/teacher/subjects");
  redirect(`/teacher/subjects/${newSubjectId}`);
}
