import { requireAnyRole } from "@/lib/appwrite/session";
import { PaperMarkForm } from "./paper-mark-form";

export default async function MarkPaperPage() {
  await requireAnyRole(["teacher", "admin"]);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          AI paper marking
        </h1>
        <p className="mt-2 text-sm text-muted">
          Upload a photo or scan of a student&apos;s handwritten answer. Provide the
          question and markscheme points, and the AI will mark it and explain each decision.
        </p>
      </div>
      <PaperMarkForm />
    </main>
  );
}
