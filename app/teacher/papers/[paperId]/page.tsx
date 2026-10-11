import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions, getRosterForPaper } from "@/lib/supabase/papers";
import { listClassMembers } from "@/lib/supabase/classes";
import {
  addPlatformStudentsAction,
  addCustomStudentsAction,
  removeRosterEntryAction,
} from "@/app/actions/papers";
import { Button } from "@/components/button";
import { CopyButton } from "@/components/copy-button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();
  if (paper.status === "draft") redirect(`/teacher/papers/${paperId}/review`);

  const [questions, roster, classMembers] = await Promise.all([
    getPaperQuestions(paperId),
    getRosterForPaper(paperId),
    listClassMembers(paper.classId, profile.id),
  ]);

  const rosterStudentIds = new Set(roster.map((r) => r.studentId).filter((id): id is string => id !== null));
  const availableMembers = classMembers.filter((m) => !rosterStudentIds.has(m.profileId));

  const totalMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);
  const linkClass =
    "rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary";

  return (
    <PageShell
      size="wide"
      aside={
        <>
          <AsideBlock title="Paper status">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <dt>Questions</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{questions.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Total marks</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{totalMarks}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>On roster</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{roster.length}</dd>
              </div>
            </dl>
          </AsideBlock>
          <AsideBlock title="Next steps">
            <div className="flex flex-col gap-2">
              <Link href={`/teacher/papers/${paperId}/mark`} className={linkClass}>
                Mark submissions
              </Link>
              <Link href={`/teacher/papers/${paperId}/results`} className={linkClass}>
                View results
              </Link>
            </div>
            <p>Each student&apos;s reference code lets the AI split an upload into one submission per student.</p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title={paper.title}
        description={`${questions.length} question${questions.length === 1 ? "" : "s"}, ready to mark.`}
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Roster</h2>

        {availableMembers.length > 0 && (
          <form action={addPlatformStudentsAction} className="flex flex-col gap-2">
            <input type="hidden" name="paperId" value={paperId} />
            <span className="text-sm font-medium text-foreground">Add students already on the platform</span>
            <div className="flex flex-col gap-1">
              {availableMembers.map((m) => (
                <label key={m.profileId} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" name="studentIds" value={m.profileId} />
                  {m.fullName ?? m.email}
                </label>
              ))}
            </div>
            <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
              Add selected
            </Button>
          </form>
        )}

        <form action={addCustomStudentsAction} className="flex flex-col gap-2">
          <input type="hidden" name="paperId" value={paperId} />
          <label htmlFor="names" className="text-sm font-medium text-foreground">
            Add students not on the platform (one name per line)
          </label>
          <textarea
            id="names"
            name="names"
            rows={3}
            placeholder={"Amara Osei\nLiam Chen"}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
            Add custom students
          </Button>
        </form>

        {roster.length > 0 && (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {roster.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.displayName}</p>
                  {!entry.studentId && <p className="text-sm text-muted">Not on the platform</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-sm text-highlight">
                    {entry.referenceCode}
                  </span>
                  <CopyButton text={entry.referenceCode} label="Copy code" />
                  <form action={removeRosterEntryAction}>
                    <input type="hidden" name="paperId" value={paperId} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button type="submit" className="text-sm text-error hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Questions</h2>
        <Stagger className="flex flex-col gap-2" delay={0.1} gap={0.04}>
          {questions.map((q) => (
            <Rise key={q.id}>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-muted">
                  Question {q.questionNumber} · {q.maxMarks} {q.maxMarks === 1 ? "mark" : "marks"}
                </p>
                <p className="mt-1 text-base text-foreground">{q.prompt}</p>
              </div>
            </Rise>
          ))}
        </Stagger>
      </section>
    </PageShell>
  );
}
