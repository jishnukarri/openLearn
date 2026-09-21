import "server-only";
import { createServiceClient } from "./server";
import { uploadFile, getFileUrl, downloadFileBytes } from "@/lib/appwrite/storage";

export type PracticeUploadSession = {
  id: string;
  studentId: string;
  topicId: string;
  questionId: string;
  status: "pending" | "ready";
  imagePaths: string[]; // Appwrite file ids, despite the name (kept for compatibility)
};

export async function createUploadSession(input: {
  studentId: string;
  topicId: string;
  questionId: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("practice_uploads")
    .insert({ student_id: input.studentId, topic_id: input.topicId, question_id: input.questionId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getUploadSession(id: string): Promise<PracticeUploadSession | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("practice_uploads")
    .select("id, student_id, topic_id, question_id, status, image_paths")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    studentId: data.student_id,
    topicId: data.topic_id,
    questionId: data.question_id,
    status: data.status,
    imagePaths: data.image_paths ?? [],
  };
}

// Uploads raw files to Appwrite storage and marks the session ready.
export async function addUploadedFiles(sessionId: string, files: File[]): Promise<void> {
  const supabase = createServiceClient();
  const fileIds = await Promise.all(files.map((f) => uploadFile(f)));

  const existing = await getUploadSession(sessionId);
  const { error } = await supabase
    .from("practice_uploads")
    .update({ status: "ready", image_paths: [...(existing?.imagePaths ?? []), ...fileIds] })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function getSignedImageUrls(fileIds: string[]): Promise<string[]> {
  return fileIds.map((id) => getFileUrl(id));
}

// Downloads raw bytes server-side for AI vision marking.
export async function downloadImageBytes(
  fileId: string
): Promise<{ bytes: Buffer; contentType: string }> {
  return downloadFileBytes(fileId);
}
