import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPaper, getPaperQuestions } from "@/lib/supabase/papers";
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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Review: {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          AI extracted {questions.length} question{questions.length === 1 ? "" : "s"}, check the
          prompt, marks, and markscheme for each before finalizing. Nothing is markable until you save.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-error">
          No questions were extracted. Go back to Papers and try uploading clearer files.
        </p>
      ) : (
        <PaperReviewForm paperId={paperId} initialQuestions={questions} />
      )}
    </main>
  );
}
