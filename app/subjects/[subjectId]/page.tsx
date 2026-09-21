import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getSubject } from "@/lib/supabase/subjects";
import { listPublishedTopicsBySubject, listPublishedSubtopicsByTopic } from "@/lib/supabase/topics";
import { getCompletedTopicIds, getCompletedSubtopicIds } from "@/lib/supabase/progress";
import { getStudentSubjects } from "@/lib/supabase/students";
import { db } from "@/lib/supabase/database-client";
import { SubjectPath, type PathUnit } from "./subject-path";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SubjectPathPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { profile } = await requireRole("student");
  const { subjectId } = await params;

  const subject = await getSubject(subjectId);
  if (!subject) notFound();

  const studentSubjects = await getStudentSubjects(profile.id);
  const enrollment = studentSubjects.find((s) => s.subject_id === subjectId);
  const examBoardId = enrollment?.exam_board_id;

  const [topics, completedTopics, completedSubtopics, knowledgeRows] = await Promise.all([
    listPublishedTopicsBySubject(subjectId, examBoardId),
    getCompletedTopicIds(profile.id),
    getCompletedSubtopicIds(profile.id),
    db
      .from("knowledge_model")
      .select("topic_name, score")
      .eq("student_id", profile.id)
      .eq("subject_id", subjectId)
      .then(({ data }) => data ?? []),
  ]);
  const diagnosticByTopic = new Map<string, number>(
    (knowledgeRows as { topic_name: string; score: number }[]).map((r) => [r.topic_name, r.score])
  );
  const subtopicsByTopic = await Promise.all(
    topics.map((t) => listPublishedSubtopicsByTopic(t.id))
  );

  const units: PathUnit[] = topics.flatMap((topic, i) => {
    const subtopics = subtopicsByTopic[i];
    const diagnosticScore = diagnosticByTopic.get(topic.name) ?? null;
    if (subtopics.length === 0) {
      return [{ id: topic.id, name: topic.name, href: `/learn/${topic.id}`, diagnosticScore }];
    }
    return subtopics.map((sub) => ({
      id: sub.id,
      name: sub.name,
      href: `/learn/subtopic/${sub.id}`,
      diagnosticScore,
    }));
  });
  const completedIds = new Set([...completedTopics, ...completedSubtopics]);

  // Weak topics = diagnostic score < 0.6, sorted weakest first.
  const weakTopics = topics
    .map((t, i) => ({ topic: t, subtopics: subtopicsByTopic[i], score: diagnosticByTopic.get(t.name) ?? null }))
    .filter((e): e is typeof e & { score: number } => e.score !== null && e.score < 0.6)
    .sort((a, b) => a.score - b.score);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {subject.name}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          Your units
        </h1>
      </div>

      <Tabs defaultValue="path">
        <TabsList variant="line">
          <TabsTrigger value="path">Learning path</TabsTrigger>
          <TabsTrigger value="revision">
            Revision
            {weakTopics.length > 0 && (
              <span className="ml-1.5 rounded-full bg-error/20 px-1.5 py-0.5 text-4xs font-bold text-error">
                {weakTopics.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="path">
          {units.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">
              No units published for this subject yet, check back soon.
            </p>
          ) : (
            <div className="mt-4">
              <SubjectPath units={units} completedIds={[...completedIds]} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="revision">
          {weakTopics.length === 0 ? (
            <div className="mt-6 rounded-xl border border-success/40 bg-success/10 p-5 text-center">
              <p className="text-sm font-medium text-success">All topics looking strong!</p>
              <p className="mt-1 text-xs text-muted">
                No weak spots from your diagnostic. Keep studying and retake the diagnostic to refresh this.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-xs text-muted">
                Topics where your diagnostic was below 60%, listed weakest first.
              </p>
              {weakTopics.map(({ topic, subtopics, score }) => {
                const pct = Math.round(score * 100);
                const firstUnit = subtopics[0]
                  ? `/learn/subtopic/${subtopics[0].id}`
                  : `/learn/${topic.id}`;
                return (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-error/30 bg-error/5 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{topic.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-error"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-2xs text-error">{pct}%</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={firstUnit}
                        className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        Revise
                      </Link>
                      <Link
                        href={`/flashcards/${topic.id}`}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-foreground"
                      >
                        Flashcards
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
