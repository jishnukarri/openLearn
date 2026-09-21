import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getRosterForPaper } from "@/lib/supabase/papers";
import { markSubmissionsAction } from "@/app/actions/paper-marking";
import { Button } from "@/components/button";

export default async function MarkSubmissionsPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();
  if (paper.status === "draft") redirect(`/teacher/papers/${paperId}/review`);

  const roster = await getRosterForPaper(paperId);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Mark submissions: {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload every student&apos;s answer script in one go, PDFs, images, or a .zip of
          either. AI reads each student&apos;s reference code to split the upload into one
          submission per student. You&apos;ll review the split on the next page before any
          marking happens.
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-error">
          Add students to the roster before marking submissions, go back to the paper page.
        </p>
      ) : (
        <form action={markSubmissionsAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
          <input type="hidden" name="paperId" value={paperId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="files" className="text-sm font-medium text-foreground">
              Student answer scripts (PDF, image, or .zip, one or many files)
            </label>
            <input
              id="files"
              name="files"
              type="file"
              accept=".pdf,.zip,image/*"
              multiple
              className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
            <p className="text-2xs text-muted">
              A student who writes their code once (e.g. only on page 1) is fine, any file
              with no readable code is grouped with the previous one.
            </p>
          </div>
          <Button type="submit" size="compact" className="self-start">
            Upload &amp; split by student
          </Button>
        </form>
      )}
    </main>
  );
}
