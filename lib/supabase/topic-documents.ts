import "server-only";
import { db } from "./database-client";
import { uploadFile, deleteFile } from "@/lib/appwrite/storage";

export type TopicDocument = {
  id: string;
  topicId: string;
  filename: string;
  chunkCount: number;
  createdAt: string;
};

export async function listDocumentsByTopic(topicId: string): Promise<TopicDocument[]> {
  const { data, error } = await db
    .from("topic_documents")
    .select("id, topic_id, filename, chunk_count, created_at")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    topicId: d.topic_id,
    filename: d.filename,
    chunkCount: d.chunk_count,
    createdAt: d.created_at,
  }));
}

// Uploads the raw file, chunks + embeds its text, and stores everything —
// one document "indexed" end to end. Chunks whose embedding failed (no
// Gemini key, or a transient API error) are still stored with a null
// embedding so the text isn't lost, they just won't surface in similarity
// search until re-indexed.
export async function createTopicDocument(input: {
  topicId: string;
  uploadedBy: string;
  filename: string;
  file: File;
  chunks: { content: string; embedding: number[] | null }[];
}): Promise<void> {
  const fileId = await uploadFile(input.file);

  const { data: doc, error: docError } = await db
    .from("topic_documents")
    .insert({
      topic_id: input.topicId,
      uploaded_by: input.uploadedBy,
      filename: input.filename,
      storage_path: fileId,
      chunk_count: input.chunks.length,
    })
    .select("id")
    .single();
  if (docError) throw docError;

  if (input.chunks.length > 0) {
    const { error: chunkError } = await db.from("topic_document_chunks").insert(
      input.chunks.map((c, i) => ({
        document_id: doc.id,
        topic_id: input.topicId,
        content: c.content,
        chunk_index: i,
        embedding: c.embedding,
      }))
    );
    if (chunkError) throw chunkError;
  }
}

export async function deleteTopicDocument(documentId: string): Promise<void> {
  const { data: doc } = await db
    .from("topic_documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  const { error } = await db.from("topic_documents").delete().eq("id", documentId);
  if (error) throw error;

  if (doc?.storage_path) {
    await deleteFile(doc.storage_path);
  }
}

export async function hasIndexedChunks(topicId: string): Promise<boolean> {
  const { count, error } = await db
    .from("topic_document_chunks")
    .select("*", { count: "exact", head: true })
    .eq("topic_id", topicId)
    .not("embedding", "is", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function searchTopicChunks(
  topicId: string,
  queryEmbedding: number[],
  matchCount = 5
): Promise<string[]> {
  const { data, error } = await db.rpc("match_topic_chunks", {
    p_topic_id: topicId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });
  if (error) throw error;
  return (data ?? []).map((row: { content: string }) => row.content);
}
