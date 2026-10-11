import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getSubject } from "@/lib/supabase/subjects";
import { listPublishedTopicsBySubject, listPublishedSubtopicsByTopic } from "@/lib/supabase/topics";
import { getCompletedTopicIds, getCompletedSubtopicIds } from "@/lib/supabase/progress";
import { getStudentSubjects } from "@/lib/supabase/students";
import { db } from "@/lib/supabase/database-client";
import { ButtonLink } from "@/components/button";
import { SubjectPath, type PathUnit } from "./subject-path";
import { PageShell, PageHeader, AsideBlock } from "@/components/page-shell";
import { Stagger, Rise } from "@/components/motion";
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

  const doneUnits = units.filter((u) => completedIds.has(u.id)).length;
  const donePct = units.length ? Math.round((doneUnits / units.length) * 100) : 0;
  const nextUnit = units.find((u) => !completedIds.has(u.id));

  const aside = (
    <>
      <AsideBlock title="Your progress">
        {units.length > 0 ? (
          <>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-foreground">
              {doneUnits}
              <span className="text-base font-normal text-muted"> of {units.length} units complete</span>
            </p>
            <div
              role="progressbar"
              aria-label="Units complete"
              aria-valuenow={donePct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-surface"
            >
              <div className="h-full rounded-full bg-highlight" style={{ width: `${donePct}%` }} />
            </div>
          </>
        ) : (
          <p>No units published for this subject yet.</p>
        )}
      </AsideBlock>

      {nextUnit && (
        <AsideBlock title="Up next">
          <p className="text-base text-foreground">{nextUnit.name}</p>
          <ButtonLink href={nextUnit.href} className="mt-1 w-full">
            {doneUnits === 0 ? "Start" : "Continue"}
          </ButtonLink>
        </AsideBlock>
      )}

      <AsideBlock title="Weak spots">
        {weakTopics.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border">
            {weakTopics.slice(0, 3).map(({ topic, score }) => (
              <li key={topic.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <span className="text-sm text-foreground">{topic.name}</span>
                <span className="font-[family-name:var(--font-mono)] text-sm text-error">{Math.round(score * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No weak spots from your diagnostic.</p>
        )}
      </AsideBlock>
    </>
  );

  return (
    <PageShell size="content" aside={aside}>
      <Stagger className="flex flex-col gap-8">
        <Rise>
          <PageHeader title={subject.name} description="Every unit is open. Follow the path in order, jump to any unit, or use revision for weak spots." className="animate-none" />
        </Rise>

        <Rise>
          <Tabs defaultValue="path">
            <TabsList variant="line">
              <TabsTrigger value="path">Learning path</TabsTrigger>
              <TabsTrigger value="revision">
                Revision
                {weakTopics.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-error/20 px-1.5 py-0.5 text-xs font-bold text-error">
                    {weakTopics.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="path">
              {units.length === 0 ? (
                <p className="mt-6 text-base text-muted">No units published for this subject yet, check back soon.</p>
              ) : (
                <div className="mt-4">
                  <SubjectPath units={units} completedIds={[...completedIds]} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="revision">
              {weakTopics.length === 0 ? (
                <div className="mt-6">
                  <p className="text-base font-medium text-success">All topics looking strong.</p>
                  <p className="mt-1 max-w-[65ch] text-sm text-muted">
                    No weak spots from your diagnostic. Keep studying and retake the diagnostic to refresh this.
                  </p>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-sm text-muted">Topics where your diagnostic was below 60%, listed weakest first.</p>
                  <ul className="flex flex-col divide-y divide-border border-y border-border">
                    {weakTopics.map(({ topic, subtopics, score }) => {
                      const pct = Math.round(score * 100);
                      const firstUnit = subtopics[0] ? `/learn/subtopic/${subtopics[0].id}` : `/learn/${topic.id}`;
                      return (
                        <li key={topic.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                          <div className="min-w-0">
                            <p className="text-base font-medium text-foreground">{topic.name}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
                                <div className="h-full rounded-full bg-error" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-sm text-error">{pct}%</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Link
                              href={firstUnit}
                              className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                            >
                              Revise
                            </Link>
                            <Link
                              href={`/flashcards/${topic.id}`}
                              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-foreground"
                            >
                              Flashcards
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Rise>
      </Stagger>
    </PageShell>
  );
}
