"use server";

import { revalidatePath } from "next/cache";
import { requireAnyRole } from "@/lib/appwrite/session";
import { indexTopicDocument } from "@/lib/rag";
import { deleteTopicDocument } from "@/lib/supabase/topic-documents";

// Uploads and indexes any number of reference documents for a topic — no
// cap in code (the ask was "more than 10"). Runs sequentially so a big
// batch upload doesn't fire a burst of concurrent embedding calls.
export async function uploadTopicDocumentsAction(formData: FormData): Promise<void> {
  const { profile } = await requireAnyRole(["admin", "teacher"]);
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Choose at least one document.");

  for (const file of files) {
    await indexTopicDocument({ topicId, uploadedBy: profile.id, file });
  }

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
}

export async function deleteTopicDocumentAction(formData: FormData): Promise<void> {
  await requireAnyRole(["admin", "teacher"]);
  const documentId = formData.get("documentId");
  if (typeof documentId !== "string") throw new Error("Missing documentId.");

  await deleteTopicDocument(documentId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
}
