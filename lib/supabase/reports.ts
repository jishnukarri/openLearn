import "server-only";
import { db } from "./database-client";

export type ContentReport = {
  id: string;
  reporterName: string;
  contextLabel: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
};

export async function createReport(input: {
  reporterId: string;
  topicId?: string | null;
  subtopicId?: string | null;
  questionId?: string | null;
  contextLabel: string;
  message: string;
}): Promise<void> {
  const { error } = await db.from("content_reports").insert({
    reporter_id: input.reporterId,
    topic_id: input.topicId ?? null,
    subtopic_id: input.subtopicId ?? null,
    question_id: input.questionId ?? null,
    context_label: input.contextLabel,
    message: input.message,
  });
  if (error) throw error;
}

export async function listOpenReports(): Promise<ContentReport[]> {
  const { data, error } = await db
    .from("content_reports")
    .select("id, context_label, message, status, created_at, profiles(full_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Array<{
    id: string;
    context_label: string;
    message: string;
    status: "open" | "resolved";
    created_at: string;
    profiles: { full_name: string | null } | null;
  }>).map((row) => ({
    id: row.id,
    reporterName: row.profiles?.full_name ?? "A student",
    contextLabel: row.context_label,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function resolveReport(reportId: string): Promise<void> {
  const { error } = await db
    .from("content_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  if (error) throw error;
}
