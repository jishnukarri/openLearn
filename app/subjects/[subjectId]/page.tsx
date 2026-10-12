import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getSubject } from "@/lib/supabase/subjects";
import { listPublishedTopicsBySubject, listPublishedSubtopicsByTopic } from "@/lib/supabase/topics";
import { getCompletedTopicIds, getCompletedSubtopicIds } from "@/lib/supabase/progress";
import { getStudentSubjects } from "@/lib/supabase/students";
import { db } from "@/lib/supabase/database-client";
import { ButtonLink } from "@/components/button";
import { SubjectPath, type PathGroup } from "./subject-path";
import { PageShell, PageHeader, AsideBlock } from "@/components/page-shell";
import { Stagger, Rise } from "@/components/motion";

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

  const groups: PathGroup[] = topics.map((topic, i) => {
    const subtopics = subtopicsByTopic[i];
    const diagnosticScore = diagnosticByTopic.get(topic.name) ?? null;
    return {
      id: topic.id,
      name: topic.name,
      summary: topic.summary ?? null,
      lessons:
        subtopics.length === 0
          ? [{ id: topic.id, name: topic.name, href: `/learn/${topic.id}`, kind: "topic" as const, diagnosticScore }]
          : subtopics.map((sub) => ({
              id: sub.id,
              name: sub.name,
              href: `/learn/subtopic/${sub.id}`,
              kind: "subtopic" as const,
              diagnosticScore,
            })),
    };
  });
  const units = groups.flatMap((g) => g.lessons);
  const completedIds = new Set([...completedTopics, ...completedSubtopics]);

  // Weak topics = diagnostic score < 0.6, sorted weakest first.
  const weakTopics = topics
    .map((t, i) => ({ topic: t, subtopics: subtopicsByTopic[i], score: diagnosticByTopic.get(t.name) ?? null }))
    .filter((e): e is typeof e & { score: number } => e.score !== null && e.score < 0.6)
    .sort((a, b) => a.score - b.score);

  const doneUnits = units.filter((u) => completedIds.has(u.id)).length;
  const donePct = units.length ? Math.round((doneUnits / units.length) * 100) : 0;
  // Point "Up next" at the weakest unfinished unit when the diagnostic found
  // a weak spot, otherwise the next one in syllabus order.
  const unfinished = units.filter((u) => !completedIds.has(u.id));
  const weakestUnit = unfinished
    .filter((u) => u.diagnosticScore != null && u.diagnosticScore < 0.6)
    .sort((a, b) => (a.diagnosticScore ?? 1) - (b.diagnosticScore ?? 1))[0];
  const nextUnit = weakestUnit ?? unfinished[0];

  const aside = (
    <>
      <AsideBlock title="Your progress">
        {units.length > 0 ? (
          <>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-foreground">
              {doneUnits}
              <span className="text-base font-normal text-muted"> of {units.length} lessons complete</span>
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
            {weakTopics.slice(0, 3).map(({ topic, subtopics, score }) => (
              <li key={topic.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <Link
                  href={subtopics[0] ? `/learn/subtopic/${subtopics[0].id}` : `/learn/${topic.id}`}
                  className="text-sm text-foreground hover:underline"
                >
                  {topic.name}
                </Link>
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
          <PageHeader title={subject.name} description="Every lesson is open. Work through the units in order or jump anywhere. Finished lessons can be revised for more XP." className="animate-none" />
        </Rise>

        <Rise>
          {units.length === 0 ? (
            <p className="text-base text-muted">No units published for this subject yet, check back soon.</p>
          ) : (
            <SubjectPath groups={groups} completedIds={[...completedIds]} />
          )}
        </Rise>
      </Stagger>
    </PageShell>
  );
}
