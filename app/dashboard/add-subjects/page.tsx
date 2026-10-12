import Link from "next/link";
import { ArrowRight, BookOpen, Compass, ListChecks } from "lucide-react";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects } from "@/lib/supabase/students";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { ButtonLink } from "@/components/button";
import { PageShell, AsideBlock } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { SubjectAdder, type Option } from "./subject-adder";

export default async function AddSubjectsPage() {
  const { profile } = await requireRole("student");

  const [subjects, current] = await Promise.all([
    listPublishedSubjects(),
    getStudentSubjects(profile.id),
  ]);
  const alreadyAdded = new Set(current.map((s) => s.subject_id));
  const available = subjects.filter((s) => !alreadyAdded.has(s.id));
  const options: Option[] = available.flatMap((subject) =>
    subject.exam_boards.map((board) => ({
      value: `${subject.id}:${board.id}`,
      subject: subject.name,
      board: board.name,
    }))
  );
  const allAdded = options.length === 0;

  const aside = allAdded ? (
    <AsideBlock title="Your subjects">
      <ul className="flex flex-col divide-y divide-border">
        {current.map((s) => (
          <li key={s.subject_id}>
            <Link
              href={`/subjects/${s.subject_id}`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <span>
                {s.subject_name} <span className="font-normal text-muted">({s.exam_board_name})</span>
              </span>
              <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </AsideBlock>
  ) : (
    <AsideBlock title="What happens next">
      <ol className="flex flex-col gap-3">
        <li className="flex gap-3">
          <Compass className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
          A short diagnostic on only the subjects you add. Subjects you've already sat aren't quizzed again.
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
  );

  return (
    <PageShell size="form" aside={aside}>
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
          <Rise className="flex flex-wrap gap-3">
            <ButtonLink href="/dashboard" className="gap-2">
              Back to my dashboard <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/onboarding/topics" variant="secondary" className="!shadow-none">
              Check topics I've covered
            </ButtonLink>
          </Rise>
        ) : (
          <SubjectAdder options={options} />
        )}
      </Stagger>
    </PageShell>
  );
}
