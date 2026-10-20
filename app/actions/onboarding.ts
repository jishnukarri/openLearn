"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import { getClassByInviteCode, joinClass } from "@/lib/supabase/classes";
import { saveSubjectSelections } from "@/lib/supabase/students";
import { markPieceComplete } from "@/lib/supabase/onboarding-progress";
import { isPieceKey } from "@/lib/onboarding-pieces";

export async function joinClassAction(
  _state: { message?: string } | undefined,
  formData: FormData
): Promise<{ message?: string } | undefined> {
  const { profile } = await requireRole("student");
  const code = formData.get("inviteCode");
  if (typeof code !== "string" || code.trim().length === 0) {
    return { message: "Enter an invite code." };
  }

  const cls = await getClassByInviteCode(code.trim());
  if (!cls) return { message: "That invite code doesn't match a class." };

  await joinClass({ classId: cls.id, studentId: profile.id });
  return { message: `Joined ${cls.name}.` };
}

const SubjectSelectionSchema = z.array(
  z.object({ subjectId: z.string(), examBoardId: z.string() })
);

function parseSelections(formData: FormData) {
  // Each checkbox value is "subjectId:examBoardId".
  const raw = formData.getAll("subjectExamBoard") as string[];
  return SubjectSelectionSchema.parse(
    raw.map((v) => {
      const [subjectId, examBoardId] = v.split(":");
      return { subjectId, examBoardId };
    })
  );
}

// First-time onboarding — routes into the diagnostic flow afterwards.
export async function saveSubjectSelectionAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");

  const parsed = parseSelections(formData);
  const startedSyllabus = formData.get("startedSyllabus") === "on";

  if (parsed.length === 0) {
    throw new Error("Pick at least one subject.");
  }

  await saveSubjectSelections(profile.id, parsed, startedSyllabus);

  redirect(startedSyllabus ? "/onboarding/topics" : "/onboarding/diagnostic");
}

// Adding subjects after onboarding is already done — a newly added subject
// has no diagnostic result yet, so route through the diagnostic gate. That
// page only offers a quiz for subjects actually missing one (a pure DB
// check), so existing subjects the student already sat a diagnostic for
// are never re-quizzed or re-generated.
export async function addSubjectsAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");

  const parsed = parseSelections(formData);
  if (parsed.length === 0) redirect("/dashboard");

  await saveSubjectSelections(profile.id, parsed, false);

  redirect("/onboarding/diagnostic");
}

export async function markPieceCompleteAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");
  const piece = formData.get("piece");
  if (typeof piece !== "string" || !isPieceKey(piece)) redirect("/dashboard");
  await markPieceComplete(profile.id, piece);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
