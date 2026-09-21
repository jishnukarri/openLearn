"use server";

import { revalidatePath } from "next/cache";
import { requireAnyRole, requireRole } from "@/lib/appwrite/session";
import { createReport, resolveReport } from "@/lib/supabase/reports";

export type ReportState = { message?: string; success?: boolean } | undefined;

export async function reportContentAction(
  _state: ReportState,
  formData: FormData
): Promise<ReportState> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);

  const message = formData.get("message");
  const contextLabel = formData.get("contextLabel");
  if (typeof message !== "string" || message.trim().length === 0) {
    return { message: "Describe the issue before submitting." };
  }
  if (typeof contextLabel !== "string") {
    return { message: "Missing context." };
  }

  const topicId = formData.get("topicId");
  const subtopicId = formData.get("subtopicId");
  const questionId = formData.get("questionId");

  await createReport({
    reporterId: profile.id,
    topicId: typeof topicId === "string" ? topicId : null,
    subtopicId: typeof subtopicId === "string" ? subtopicId : null,
    questionId: typeof questionId === "string" ? questionId : null,
    contextLabel,
    message: message.trim(),
  });

  return { success: true };
}

export async function resolveReportAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const reportId = formData.get("reportId");
  if (typeof reportId !== "string") throw new Error("Missing reportId.");

  await resolveReport(reportId);
  revalidatePath("/admin/reports");
}
