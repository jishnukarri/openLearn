import "server-only";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { getTopicDiagnosticPools } from "@/lib/supabase/topic-diagnostic-questions";
import { createDiagnosticSessionFromPool, type DiagnosticQuestion } from "@/lib/supabase/diagnostic";

// Per-topic sample size for the guest teaser — small enough to keep the
// whole quiz inside a "5 minute" budget across several topics, but still
// touching every topic at least once. Zero AI cost: this only reads
// already-generated pool rows (see lib/ai/diagnostic-pool.ts).
const QUESTIONS_PER_TOPIC_SAMPLE = 2;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Builds a guest diagnostic session by sampling from each selected
// subject's topics' pre-generated question pools. Topics with no pool yet
// (pool generation is best-effort and can fail/lag) are silently skipped —
// better a shorter quiz than a broken one.
export async function buildGuestDiagnostic(
  guestToken: string,
  subjectIds: string[]
): Promise<{ sessionId: string; questionCount: number } | null> {
  const topicsBySubject = await Promise.all(
    subjectIds.map((id) => listPublishedTopicsBySubject(id))
  );
  const allTopics = topicsBySubject.flat();
  if (allTopics.length === 0) return null;

  const pools = await getTopicDiagnosticPools(allTopics.map((t) => t.id));

  const questions: Array<{
    subjectId: string;
    topicName: string | null;
    type: "mcq" | "fill_blank" | "match" | "short_answer";
    prompt: string;
    maxMarks: number;
    content: DiagnosticQuestion["content"];
  }> = [];

  for (const topic of allTopics) {
    const pool = pools.get(topic.id);
    if (!pool || pool.length === 0) continue;
    const sample = shuffle(pool).slice(0, QUESTIONS_PER_TOPIC_SAMPLE);
    for (const q of sample) {
      questions.push({
        subjectId: topic.subject_id,
        topicName: topic.name,
        type: q.type,
        prompt: q.prompt,
        maxMarks: q.maxMarks,
        content: q.content as DiagnosticQuestion["content"],
      });
    }
  }

  if (questions.length === 0) return null;

  const sessionId = await createDiagnosticSessionFromPool({
    guestToken,
    questions: shuffle(questions),
  });
  return { sessionId, questionCount: questions.length };
}
