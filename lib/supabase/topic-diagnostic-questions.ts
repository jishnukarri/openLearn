import "server-only";
import { db } from "./database-client";
import type { PoolQuestion } from "@/lib/ai/diagnostic-pool";
import type { QuestionType } from "@/lib/ai/diagnostic";
import { numericMetaFrom } from "@/lib/diagnostic-numeric";

export type PoolQuestionRow = {
  id: string;
  topicId: string;
  type: QuestionType;
  prompt: string;
  maxMarks: number;
  content: Record<string, unknown>;
};

function toContent(q: PoolQuestion): Record<string, unknown> {
  switch (q.type) {
    case "mcq":
      return { options: q.options, correctIndex: q.correctIndex };
    case "fill_blank":
      return { blankAnswer: q.blankAnswer };
    case "numeric":
      return { blankAnswer: q.blankAnswer, numeric: numericMetaFrom(q) };
    case "match":
      return { pairs: q.matchPairs };
    case "short_answer":
      return { markscheme: q.markscheme };
  }
}

export async function saveTopicDiagnosticPool(
  topicId: string,
  questions: PoolQuestion[]
): Promise<void> {
  if (questions.length === 0) return;
  const rows = questions.map((q) => ({
    topic_id: topicId,
    type: q.type === "numeric" ? "fill_blank" : q.type,
    prompt: q.prompt,
    max_marks: q.type === "match" ? q.matchPairs.length || 1 : q.maxMarks || 1,
    content: toContent(q),
  }));
  const { error } = await db.from("topic_diagnostic_questions").insert(rows);
  if (error) throw error;
}

export async function hasTopicDiagnosticPool(topicId: string): Promise<boolean> {
  const { count, error } = await db
    .from("topic_diagnostic_questions")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// Pulls every pooled question for a set of topics — sampling down to a
// per-topic budget happens in the caller (lib/guest-diagnostic.ts), since
// it needs to shuffle across topics fairly, not just per-topic.
export async function getTopicDiagnosticPools(
  topicIds: string[]
): Promise<Map<string, PoolQuestionRow[]>> {
  if (topicIds.length === 0) return new Map();
  const { data, error } = await db
    .from("topic_diagnostic_questions")
    .select("id, topic_id, type, prompt, max_marks, content")
    .in("topic_id", topicIds);
  if (error) throw error;

  const byTopic = new Map<string, PoolQuestionRow[]>();
  for (const row of data as any[]) {
    const list = byTopic.get(row.topic_id) ?? [];
    list.push({
      id: row.id,
      topicId: row.topic_id,
      type: row.type,
      prompt: row.prompt,
      maxMarks: row.max_marks,
      content: row.content,
    });
    byTopic.set(row.topic_id, list);
  }
  return byTopic;
}
