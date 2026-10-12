import Link from "next/link";
import { ArrowRight, BookOpen, Compass, ListChecks } from "lucide-react";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects } from "@/lib/supabase/students";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { getCompletedTopicIds } from "@/lib/supabase/progress";
import { ButtonLink } from "@/components/button";
import { PageShell, AsideBlock } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { SubjectAdder, type Option } from "./subject-adder";

export default async function AddSubjectsPage() {
  const { profile } = await requireRole("student");

  const [subjects, current, completed] = await Promise.all([
    listPublishedSubjects(),
    getStudentSubjects(profile.id),
    getCompletedTopicIds(profile.id),
  ]);
  const topicsBySubject = new Map(
    await Promise.all(
      subjects.map(async (s) => [s.id, await listPublishedTopicsBySubject(s.id)] as const)
    )
  );
  const alreadyAdded = new Set(current.map((s) => s.subject_id));
  const available = subjects.filter((s) => !alreadyAdded.has(s.id));
  const options: Option[] = available.flatMap((subject) =>
    subject.exam_boards.map((board) => ({
      value: `${subject.id}:${board.id}`,
      subject: subject.name,
      board: board.name,
      topicCount: topicsBySubject.get(subject.id)?.length ?? 0,
      topicPreview: (topicsBySubject.get(subject.id) ?? []).slice(0, 3).map((t) => t.name),
    }))
  );
  const allAdded = options.length === 0;
  const currentProgress = current.map((s) => {
    const topics = topicsBySubject.get(s.subject_id) ?? [];
    const done = topics.filter((t) => completed.has(t.id)).length;
    return { ...s, total: topics.length, done };
  });

  const yourSubjects = (
    <AsideBlock title="Your subjects">
      <ul className="flex flex-col divide-y divide-border">
        {currentProgress.map((s) => (
          <li key={s.subject_id}>
            <Link
              href={`/subjects/${s.subject_id}`}
              className="group flex flex-col gap-1.5 py-3 first:pt-0"
            >
              <span className="flex items-center justify-between gap-3 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                <span>
                  {s.subject_name} <span className="font-normal text-muted">({s.exam_board_name})</span>
                </span>
                <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </span>
              <span className="flex items-center gap-2">
                <span
                  role="progressbar"
                  aria-label={`${s.subject_name} topics complete`}
                  aria-valuemin={0}
                  aria-valuemax={s.total}
                  aria-valuenow={s.done}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
                >
                  <span
                    className="block h-full rounded-full bg-highlight"
                    style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }}
                  />
                </span>
                <span className="font-[family-name:var(--font-mono)] text-sm text-muted">
                  {s.done}/{s.total}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AsideBlock>
  );

  const aside = allAdded ? (
    yourSubjects
  ) : (
    <>
      {yourSubjects}
      <AsideBlock title="What happens next">
        <ol className="flex flex-col gap-3">
          <li className="flex gap-3">
            <Compass className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
            A short diagnostic on only the subjects you add. Subjects you&apos;ve already sat aren&apos;t quizzed again.
          </li>
          <li className="flex gap-3">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
            Your results show what you already know and where the gaps are.
          </li>
          <li className="flex gap-3">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
            Lessons then start with what you need most.
          </li>
        </ol>
      </AsideBlock>
    </>
  );

  return (
    <PageShell size="wide" aside={aside}>
      <Stagger className="flex flex-col gap-8">
        <Rise>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl lg:leading-[1.1]">
            {allAdded ? "You're covering everything we have" : "Add a subject"}
          </h1>
          <p className="mt-3 max-w-[60ch] text-base text-muted">
            {allAdded
              ? "Every published subject is already on your list. New ones will appear here as soon as they go live."
              : "Pick the subjects and exam boards you want to start studying."}
          </p>
        </Rise>

        {allAdded ? (
          <Rise className="flex flex-col gap-8">
            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {currentProgress.map((s) => (
                <li key={s.subject_id}>
                  <Link
                    href={`/subjects/${s.subject_id}`}
                    className="flex min-h-40 flex-col justify-between gap-6 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary"
                  >
                    <span>
                      <span className="block font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
                        {s.subject_name}
                      </span>
                      <span className="mt-1 block text-sm text-muted">
                        {s.exam_board_name} · {s.total} {s.total === 1 ? "topic" : "topics"}
                      </span>
                    </span>
                    <span className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span className="font-[family-name:var(--font-mono)] text-muted">{s.done} of {s.total} complete</span>
                      <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
            <ButtonLink href="/dashboard" className="gap-2">
              Back to my dashboard <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/onboarding/topics" variant="secondary" className="!shadow-none">
              Check topics I&apos;ve covered
            </ButtonLink>
            </div>
          </Rise>
        ) : (
          <SubjectAdder options={options} />
        )}
      </Stagger>
    </PageShell>
  );
}
