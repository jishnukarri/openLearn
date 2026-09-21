import { requireRole } from "@/lib/appwrite/session";
import { listSubjectSummariesByOwner, listExamBoards } from "@/lib/supabase/subjects";
import { listPublishedAdminSubjects } from "@/lib/supabase/subject-copy";
import { copySubjectAction } from "@/app/actions/subject-copy";
import { AdminSubjectGrid } from "@/components/admin-subject-grid";
import { Button } from "@/components/button";
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
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Your subjects
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create your own subject, add exam boards, paste a spec (optional), generate
          topics, then publish. Lessons and a practice question generate
          automatically as soon as each topic exists. These are separate from
          admin&apos;s subjects, you can only manage the ones you create here.
        </p>
      </div>

      <CreateSubjectForm examBoards={examBoards} />

      <AddExamBoardForm />

      {adminSubjects.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Copy from admin
          </h2>
          <p className="mt-1 text-sm text-muted">
            Get your own editable copy of an admin subject, including its topics and lessons.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {adminSubjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted">{s.topicCount} topics</p>
                </div>
                <form action={copySubjectAction}>
                  <input type="hidden" name="subjectId" value={s.id} />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                    Copy to my subjects
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {subjects.length === 0 ? (
        <p className="text-sm text-muted">No subjects yet, add the first one above.</p>
      ) : (
        <AdminSubjectGrid initialSubjects={subjects} basePath="/teacher/subjects" />
      )}
    </main>
  );
}
