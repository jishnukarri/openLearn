import { requireRole } from "@/lib/appwrite/session";
import { listSubjectSummaries, listExamBoards } from "@/lib/supabase/subjects";
import { AdminSubjectGrid } from "@/components/admin-subject-grid";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { CreateSubjectForm } from "./create-subject-form";
import { AddExamBoardForm } from "./add-exam-board-form";

export default async function AdminSubjectsPage() {
  await requireRole("admin");

  const [subjects, examBoards] = await Promise.all([
    listSubjectSummaries(),
    listExamBoards(),
  ]);

  const publishedCount = subjects.filter((s) => s.status === "published").length;
  const totalTopics = subjects.reduce((sum, s) => sum + s.topicCount, 0);

  const overview = [
    ["Subjects", subjects.length],
    ["Published", publishedCount],
    ["Exam boards", examBoards.length],
    ["Total topics", totalTopics],
  ] as const;

  return (
    <PageShell
      size="wide"
      aside={
        <>
          <AsideBlock title="New subject">
            <CreateSubjectForm examBoards={examBoards} />
          </AsideBlock>
          <AsideBlock title="Exam boards">
            <AddExamBoardForm />
          </AsideBlock>
          <AsideBlock title="Content overview">
            <dl className="flex flex-col gap-2">
              {overview.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <dt>{label}</dt>
                  <dd className="font-[family-name:var(--font-mono)] text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title="Subjects"
        description="Create a subject, add exam boards, paste a spec (optional), generate topics, then publish. Lessons and a practice question generate automatically as soon as each topic exists."
      />

      {subjects.length === 0 ? (
        <p className="text-sm text-muted">No subjects yet, add the first one in the panel.</p>
      ) : (
        <Stagger>
          <Rise>
            <AdminSubjectGrid initialSubjects={subjects} />
          </Rise>
        </Stagger>
      )}
    </PageShell>
  );
}
