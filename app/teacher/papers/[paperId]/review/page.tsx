import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions } from "@/lib/supabase/papers";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { PaperReviewForm } from "./review-form";

export default async function PaperReviewPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { profile } = await requireRole("teacher");
  const { paperId } = await params;

  const paper = await getPaper(paperId);
  if (!paper || paper.teacherId !== profile.id) notFound();

  const questions = await getPaperQuestions(paperId);

  return (
    <PageShell
      size="fluid"
      aside={
        <AsideBlock title="Before you save">
          <p>Check each question&apos;s prompt, marks and markscheme points against your paper.</p>
          <p>Nothing is markable until you save and finalize.</p>
        </AsideBlock>
      }
    >
      <PageHeader
        title={`Review: ${paper.title}`}
        description={`AI extracted ${questions.length} question${questions.length === 1 ? "" : "s"}, check the prompt, marks, and markscheme for each before finalizing.`}
      />

      {questions.length === 0 ? (
        <p className="text-sm text-error">
          No questions were extracted. Go back to Papers and try uploading clearer files.
        </p>
      ) : (
        <PaperReviewForm paperId={paperId} initialQuestions={questions} />
      )}
    </PageShell>
  );
}
