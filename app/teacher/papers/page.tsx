import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { listPapersForTeacher } from "@/lib/supabase/papers";
import { listClassesByTeacher } from "@/lib/supabase/classes";
import { createPaperAction } from "@/app/actions/papers";
import { Button } from "@/components/button";

export default async function TeacherPapersPage() {
  const { profile } = await requireRole("teacher");
  const [papers, classes] = await Promise.all([
    listPapersForTeacher(profile.id),
    listClassesByTeacher(profile.id),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Papers
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload a question paper and its markscheme, AI extracts a structured,
          markable question set you review before it&apos;s used.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="text-sm text-muted">
          Create a class first (on the Classes tab) before setting up a paper.
        </p>
      ) : (
        <form
          action={createPaperAction}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="classId" className="text-sm font-medium text-foreground">
              Class
            </label>
            <select
              id="classId"
              name="classId"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
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
            <input
              id="title"
              name="title"
              placeholder="e.g. Mock Exam, Paper 1"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

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
              className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
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
              className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
          </div>

          <Button type="submit" size="compact" className="self-start">
            Upload &amp; extract questions
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {papers.length === 0 ? (
          <p className="text-sm text-muted">No papers yet, create one above.</p>
        ) : (
          papers.map((p) => (
            <Link
              key={p.id}
              href={p.status === "ready" ? `/teacher/papers/${p.id}` : `/teacher/papers/${p.id}/review`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 hover:border-primary"
            >
              <p className="text-sm font-medium text-foreground">{p.title}</p>
              <span
                className={`rounded-full border px-3 py-1 text-xs ${
                  p.status === "ready"
                    ? "border-success/40 text-success"
                    : "border-highlight/40 text-highlight"
                }`}
              >
                {p.status === "ready" ? "Ready" : "Needs review"}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
