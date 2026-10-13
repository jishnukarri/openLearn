import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects } from "@/lib/supabase/students";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { skipDiagnosticAction } from "@/app/actions/diagnostic";
import { Button } from "@/components/button";
import { PageShell, AsideBlock } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
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
    <PageShell
      size="form"
      aside={
        <AsideBlock title="What happens next">
          <ol className="flex list-decimal flex-col gap-1.5 pl-4 marker:text-muted">
            <li>We build a short quiz on the topics you pick.</li>
            <li>We check what stuck and reteach anything shaky.</li>
            <li>The rest of your lessons start from what you already know.</li>
          </ol>
        </AsideBlock>
      }
    >
      <Stagger className="flex flex-col gap-8">
        <Rise>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl lg:leading-[1.1]">
            What have you covered already?
          </h1>
          <p className="mt-3 max-w-[60ch] text-base text-muted">
            Pick up to 6 topics you&apos;ve already done at school, we&apos;ll
            check what stuck and reteach anything shaky, alongside recapping
            what you know.
          </p>
        </Rise>

        <Rise>
          {hasAnyTopics ? (
            <RecapTopicsForm topicsBySubject={topicsBySubject} />
          ) : (
            <div className="flex max-w-md flex-col gap-4">
              <p className="text-base text-muted">
                No topics are published for your subjects yet, so there&apos;s
                nothing to recap-test right now.
              </p>
              <form action={skipDiagnosticAction}>
                <Button type="submit">Continue to dashboard</Button>
              </form>
            </div>
          )}
        </Rise>
      </Stagger>
    </PageShell>
  );
}
