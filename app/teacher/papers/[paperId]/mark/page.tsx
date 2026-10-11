import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getRosterForPaper } from "@/lib/supabase/papers";
import { markSubmissionsAction } from "@/app/actions/paper-marking";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";

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
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="What happens next">
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>AI reads each student&apos;s reference code to split the upload into one submission per student.</li>
              <li>You review the split on the results page.</li>
              <li>Marking only starts once you ask for it.</li>
            </ol>
          </AsideBlock>
          <AsideBlock title="Roster">
            <p>
              {roster.length} student{roster.length === 1 ? "" : "s"} on this paper&apos;s roster.
            </p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title={`Mark submissions: ${paper.title}`}
        description="Upload every student's answer script in one go, PDFs, images, or a .zip of either."
      />

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
              className="text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            <p className="max-w-[65ch] text-sm text-muted">
              A student who writes their code once (e.g. only on page 1) is fine, any file
              with no readable code is grouped with the previous one.
            </p>
          </div>
          <Button type="submit" size="compact" className="self-start">
            Upload &amp; split by student
          </Button>
        </form>
      )}
    </PageShell>
  );
}
