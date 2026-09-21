import { requireRole } from "@/lib/appwrite/session";
import { listSubjectSummaries, listExamBoards } from "@/lib/supabase/subjects";
import { AdminSubjectGrid } from "@/components/admin-subject-grid";
import { CreateSubjectForm } from "./create-subject-form";
import { AddExamBoardForm } from "./add-exam-board-form";

export default async function AdminSubjectsPage() {
  await requireRole("admin");

  const [subjects, examBoards] = await Promise.all([
    listSubjectSummaries(),
    listExamBoards(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Subjects
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create a subject, add exam boards, paste a spec (optional), generate
          topics, then publish. Lessons and a practice question generate
          automatically as soon as each topic exists.
        </p>
      </div>

      <CreateSubjectForm examBoards={examBoards} />

      <AddExamBoardForm />

      {subjects.length === 0 ? (
        <p className="text-sm text-muted">No subjects yet, add the first one above.</p>
      ) : (
        <AdminSubjectGrid initialSubjects={subjects} />
      )}
    </main>
  );
}

