import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects } from "@/lib/supabase/students";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { skipDiagnosticAction } from "@/app/actions/diagnostic";
import { Button } from "@/components/button";
import { RecapTopicsForm } from "./recap-topics-form";

export default async function RecapTopicsPage() {
  const { profile } = await requireRole("student");
  const subjects = await getStudentSubjects(profile.id);

  const topicsBySubject = await Promise.all(
    subjects.map(async (s) => ({
      subject: s,
      topics: await listPublishedTopicsBySubject(s.subject_id),
    }))
  );

  const hasAnyTopics = topicsBySubject.some((t) => t.topics.length > 0);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          What have you covered already?
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pick up to 3 topics you&apos;ve already done at school, we&apos;ll
          check what stuck and reteach anything shaky, alongside recapping
          what you know.
        </p>
      </div>

      {hasAnyTopics ? (
        <RecapTopicsForm topicsBySubject={topicsBySubject} />
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">
            No topics are published for your subjects yet, so there&apos;s
            nothing to recap-test right now.
          </p>
          <form action={skipDiagnosticAction}>
            <Button type="submit" className="w-full">
              Continue to dashboard
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}
