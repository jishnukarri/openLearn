import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { listPapersForTeacher } from "@/lib/supabase/papers";
import { listClassesByTeacher } from "@/lib/supabase/classes";
import { createPaperAction } from "@/app/actions/papers";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

export default async function TeacherPapersPage() {
  const { profile } = await requireRole("teacher");
  const [papers, classes] = await Promise.all([
    listPapersForTeacher(profile.id),
    listClassesByTeacher(profile.id),
  ]);

  const readyCount = papers.filter((p) => p.status === "ready").length;
  const reviewCount = papers.length - readyCount;
  const fileClass =
    "text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white";
  const field =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="Paper workflow">
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>Upload the question paper and its markscheme.</li>
              <li>AI extracts a structured question set.</li>
              <li>You review the questions, marks and markscheme before anything is markable.</li>
              <li>Add a roster, upload student scripts and mark.</li>
            </ol>
          </AsideBlock>
          <AsideBlock title="Your papers">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <dt>Ready</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{readyCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Needs review</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{reviewCount}</dd>
              </div>
            </dl>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title="Papers"
        description="Upload a question paper and its markscheme, AI extracts a structured, markable question set you review before it's used."
      />

      {classes.length === 0 ? (
        <p className="text-sm text-muted">
          Create a class first (on the Classes tab) before setting up a paper.
        </p>
      ) : (
        <form
          action={createPaperAction}
          className="animate-fade-slide-up flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="classId" className="text-sm font-medium text-foreground">
                Class
              </label>
              <select id="classId" name="classId" className={field}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-foreground">
                Paper title
              </label>
              <input id="title" name="title" placeholder="e.g. Mock Exam, Paper 1" className={field} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="questionPaperFiles" className="text-sm font-medium text-foreground">
                Question paper (PDF or image, one or more files)
              </label>
              <input
                id="questionPaperFiles"
                name="questionPaperFiles"
                type="file"
                accept=".pdf,image/*"
                multiple
                className={fileClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="markschemeFiles" className="text-sm font-medium text-foreground">
                Markscheme (PDF or image, one or more files)
              </label>
              <input
                id="markschemeFiles"
                name="markschemeFiles"
                type="file"
                accept=".pdf,image/*"
                multiple
                className={fileClass}
              />
            </div>
          </div>

          <Button type="submit" size="compact" className="self-start">
            Upload &amp; extract questions
          </Button>
        </form>
      )}

      {papers.length === 0 ? (
        <p className="text-sm text-muted">No papers yet, create one above.</p>
      ) : (
        <Stagger className="flex flex-col gap-2" delay={0.1} gap={0.05}>
          {papers.map((p) => (
            <Rise key={p.id}>
              <Link
                href={p.status === "ready" ? `/teacher/papers/${p.id}` : `/teacher/papers/${p.id}/review`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors duration-150 hover:border-primary"
              >
                <p className="text-base font-medium text-foreground">{p.title}</p>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                    p.status === "ready"
                      ? "border-success/40 text-success"
                      : "border-highlight/40 text-highlight"
                  }`}
                >
                  {p.status === "ready" ? "Ready" : "Needs review"}
                </span>
              </Link>
            </Rise>
          ))}
        </Stagger>
      )}
    </PageShell>
  );
}
