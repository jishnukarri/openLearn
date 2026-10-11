import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { getSubjectsNeedingDiagnostic, getFirstTopicPerSubject } from "@/lib/supabase/students";
import { Button } from "@/components/button";
import { DiagnosticForms } from "./diagnostic-forms";

export default async function DiagnosticIntroPage() {
  const { profile } = await requireRole("student");
  const needing = await getSubjectsNeedingDiagnostic(profile.id);

  if (needing.length === 0) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
            You&apos;re all caught up
          </h1>
          <p className="mt-2 text-sm text-muted">
            Every subject you&apos;re studying already has a diagnostic
            result, no new quiz needed right now. If you&apos;ve covered
            more topics in class since your last check-in, you can log those
            separately.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
          <Link href="/onboarding/topics">
            <Button variant="secondary" className="!shadow-none">
              Log topics I&apos;ve covered
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const firstTopics = await getFirstTopicPerSubject(needing.map((s) => s.subject_id));
  const subjectNames = needing.map((s) => s.subject_name).join(", ");

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <DiagnosticForms
        subjectNames={subjectNames}
        subjectCount={needing.length}
        hasFirstTopics={firstTopics.size > 0}
      />
    </main>
  );
}
