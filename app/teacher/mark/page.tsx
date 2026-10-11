import { requireAnyRole } from "@/lib/appwrite/session";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { PaperMarkForm } from "./paper-mark-form";

export default async function MarkPaperPage() {
  await requireAnyRole(["teacher", "admin"]);
  return (
    <PageShell
      size="wide"
      aside={
        <>
          <AsideBlock title="How marking works">
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>Paste the question and list the markscheme points, one per line.</li>
              <li>Upload photos, scans or a PDF of the handwritten answer.</li>
              <li>The AI reads the answer and checks it against each point.</li>
              <li>You get a score and a comment explaining every point it gave or withheld.</li>
            </ol>
          </AsideBlock>
          <AsideBlock title="For best results">
            <p>Include the mark total in the question, for example [3 marks], and keep each markscheme point to a single idea.</p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title="AI paper marking"
        description="Upload a photo or scan of a student's handwritten answer. Provide the question and markscheme points, and the AI will mark it and explain each decision."
      />
      <PaperMarkForm />
    </PageShell>
  );
}
