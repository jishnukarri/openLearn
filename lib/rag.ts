import "server-only";
import { extractTextFromFile } from "@/lib/extract-text";
import { chunkText } from "@/lib/text-chunk";
import { generateEmbedding } from "@/lib/ai/embeddings";
import {
  createTopicDocument,
  hasIndexedChunks,
  searchTopicChunks,
} from "@/lib/supabase/topic-documents";

// Extracts, chunks, and embeds one uploaded reference document for a
// topic. Runs chunk embeddings sequentially — deliberately not
// Promise.all'd, so a 10+ document upload doesn't fire dozens of
// concurrent embedding calls at once against the platform's Gemini quota.
export async function indexTopicDocument(input: {
  topicId: string;
  uploadedBy: string;
  file: File;
}): Promise<void> {
  const text = await extractTextFromFile(input.file);
  const pieces = chunkText(text);

  const chunks: { content: string; embedding: number[] | null }[] = [];
  for (const content of pieces) {
    chunks.push({ content, embedding: await generateEmbedding(content) });
  }

  await createTopicDocument({
    topicId: input.topicId,
    uploadedBy: input.uploadedBy,
    filename: input.file.name,
    file: input.file,
    chunks,
  });
}

// Returns a prompt-ready reference block for this topic, or "" when the
// topic has no indexed documents (or embeddings aren't configured) — the
// generators fall back to their normal unguided behavior in that case, so
// RAG is purely additive and never blocks generation.
export async function getReferenceContext(
  topicId: string,
  topicName: string
): Promise<string> {
  const indexed = await hasIndexedChunks(topicId);
  if (!indexed) return "";

  const queryEmbedding = await generateEmbedding(
    `Key facts, definitions, and exam-relevant content for "${topicName}"`
  );
  if (!queryEmbedding) return "";

  const chunks = await searchTopicChunks(topicId, queryEmbedding, 5);
  if (chunks.length === 0) return "";

  return (
    `\n\nThe teacher who set up this topic uploaded their own reference ` +
    `material. Ground your answer in it where relevant, and don't ` +
    `contradict it — but you can still use general subject knowledge to ` +
    `fill gaps it doesn't cover. Reference material:\n` +
    chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")
  );
}

// Convenience wrapper for the many call sites that build a topic's
// customInstructions string and pass it straight into a generator — folds
// in the reference block (if any) without changing any generator's
// signature. Safe to call even when nothing is indexed (adds nothing).
export async function withReferenceContext(
  topicId: string,
  topicName: string,
  baseInstructions?: string | null
): Promise<string | undefined> {
  const reference = await getReferenceContext(topicId, topicName);
  const combined = [baseInstructions, reference].filter(Boolean).join("");
  return combined || undefined;
}
