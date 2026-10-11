import { requireRole } from "@/lib/appwrite/session";
import { listSubjectSummariesByOwner, listExamBoards } from "@/lib/supabase/subjects";
import { listPublishedAdminSubjects } from "@/lib/supabase/subject-copy";
import { copySubjectAction } from "@/app/actions/subject-copy";
import { AdminSubjectGrid } from "@/components/admin-subject-grid";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { CreateSubjectForm } from "@/app/admin/subjects/create-subject-form";
import { AddExamBoardForm } from "@/app/admin/subjects/add-exam-board-form";

export default async function TeacherSubjectsPage() {
  const { profile } = await requireRole("teacher");

  const [subjects, examBoards, adminSubjects] = await Promise.all([
    listSubjectSummariesByOwner(profile.id),
    listExamBoards(),
    listPublishedAdminSubjects(),
  ]);

  return (
    <PageShell
      size="wide"
      aside={
        <>
          <AsideBlock title="From idea to published">
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>Create a subject and add exam boards.</li>
              <li>Paste a spec (optional) and generate topics.</li>
              <li>Publish the subject.</li>
            </ol>
            <p>Lessons and a practice question generate automatically as soon as each topic exists.</p>
          </AsideBlock>
          <AsideBlock title="Yours only">
            <p>
              These are separate from admin&apos;s subjects, you can only manage the ones you create
              here. You currently have {subjects.length}.
            </p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title="Your subjects"
        description="Create your own subject, add exam boards, paste a spec (optional), generate topics, then publish."
      />

      <CreateSubjectForm examBoards={examBoards} />

      <AddExamBoardForm />

      {adminSubjects.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
              Copy from admin
            </h2>
            <p className="mt-1 text-sm text-muted">
              Get your own editable copy of an admin subject, including its topics and lessons.
            </p>
          </div>
          <Stagger className="grid gap-3 sm:grid-cols-2" delay={0.05} gap={0.05}>
            {adminSubjects.map((s) => (
              <Rise key={s.id}>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-foreground">{s.name}</p>
                    <p className="text-sm text-muted">{s.topicCount} topics</p>
                  </div>
                  <form action={copySubjectAction}>
                    <input type="hidden" name="subjectId" value={s.id} />
                    <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                      Copy to my subjects
                    </Button>
                  </form>
                </div>
              </Rise>
            ))}
          </Stagger>
        </section>
      )}

      {subjects.length === 0 ? (
        <p className="text-sm text-muted">No subjects yet, add the first one above.</p>
      ) : (
        <AdminSubjectGrid initialSubjects={subjects} basePath="/teacher/subjects" />
      )}
    </PageShell>
  );
}
