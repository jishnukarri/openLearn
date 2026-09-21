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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
            {paper.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {questions.length} question{questions.length === 1 ? "" : "s"}, ready to mark.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/teacher/papers/${paperId}/mark`}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-foreground"
          >
            Mark submissions
          </Link>
          <Link
            href={`/teacher/papers/${paperId}/results`}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-foreground"
          >
            View results
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Question {q.questionNumber} · {q.maxMarks} {q.maxMarks === 1 ? "mark" : "marks"}
            </p>
            <p className="mt-1 text-sm text-foreground">{q.prompt}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Roster</h2>

        {availableMembers.length > 0 && (
          <form action={addPlatformStudentsAction} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <input type="hidden" name="paperId" value={paperId} />
            <span className="text-xs font-medium text-foreground">Add students already on the platform</span>
            <div className="flex flex-col gap-1">
              {availableMembers.map((m) => (
                <label key={m.profileId} className="flex items-center gap-2 text-xs text-foreground">
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

        <form action={addCustomStudentsAction} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <input type="hidden" name="paperId" value={paperId} />
          <label htmlFor="names" className="text-xs font-medium text-foreground">
            Add students not on the platform (one name per line)
          </label>
          <textarea
            id="names"
            name="names"
            rows={3}
            placeholder={"Amara Osei\nLiam Chen"}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
            Add custom students
          </Button>
        </form>

        {roster.length > 0 && (
          <div className="flex flex-col gap-1">
            {roster.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium text-foreground">{entry.displayName}</p>
                  {!entry.studentId && <p className="text-2xs text-muted">Not on the platform</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-xs text-highlight">
                    {entry.referenceCode}
                  </span>
                  <CopyButton text={entry.referenceCode} label="Copy code" />
                  <form action={removeRosterEntryAction}>
                    <input type="hidden" name="paperId" value={paperId} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button type="submit" className="text-xs text-error hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
