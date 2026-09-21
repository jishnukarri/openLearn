import { AlertTriangle } from "lucide-react";

// Blocks every route under /teacher/papers/* (create, review, mark, results)
// behind a single message instead of rendering the page underneath —
// the AI paper-splitting pipeline still has real gaps (see conversation:
// sequential per-page AI calls that can hit provider rate limits at class
// scale, and no way to recover a submission that silently merged two
// students together) and isn't ready for a teacher to rely on yet.
export default function PapersLayout() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-24 text-center">
      <AlertTriangle className="size-10 text-highlight" strokeWidth={1.75} />
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
        Papers is still being built
      </h1>
      <p className="max-w-md text-sm text-muted">
        Uploading question papers, marking student submissions, and reviewing
        results here isn&apos;t ready to use yet. Come back once it&apos;s finished.
      </p>
    </main>
  );
}
