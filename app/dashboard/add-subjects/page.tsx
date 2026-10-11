import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects } from "@/lib/supabase/students";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { addSubjectsAction } from "@/app/actions/onboarding";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageShell, AsideBlock } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export default async function AddSubjectsPage() {
  const { profile } = await requireRole("student");

  const [subjects, current] = await Promise.all([
    listPublishedSubjects(),
    getStudentSubjects(profile.id),
  ]);
  const alreadyAdded = new Set(current.map((s) => s.subject_id));
  const available = subjects.filter((s) => !alreadyAdded.has(s.id));

  return (
    <PageShell
      size="form"
      aside={
        <AsideBlock title="What happens next">
          <p>
            After you add subjects, you&apos;ll take a short diagnostic quiz so
            your lessons start where you need them.
          </p>
        </AsideBlock>
      }
    >
      <Stagger className="flex flex-col gap-8">
        <Rise>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl lg:leading-[1.1]">
            Add a subject
          </h1>
          <p className="mt-3 max-w-[60ch] text-base text-muted">
            Pick another subject and exam board to start studying.
          </p>
        </Rise>

        <Rise>
          {available.length === 0 ? (
            <p className="max-w-[60ch] text-base text-muted">
              You&apos;re already studying everything that&apos;s published, check
              back once more subjects go live.
            </p>
          ) : (
            <form action={addSubjectsAction} className="flex flex-col gap-5">
              <FieldGroup className="gap-2">
                {available.map((subject) =>
                  subject.exam_boards.map((board) => {
                    const id = `subject-${subject.id}-${board.id}`;
                    return (
                      <Field key={`${subject.id}:${board.id}`} orientation="horizontal" className="rounded-lg border border-border bg-background px-3 py-2.5 has-[[data-checked]]:border-primary">
                        <Checkbox
                          id={id}
                          name="subjectExamBoard"
                          value={`${subject.id}:${board.id}`}
                        />
                        <FieldLabel htmlFor={id} className="cursor-pointer text-base text-foreground">
                          {subject.name}{" "}
                          <span className="text-sm text-muted">({board.name})</span>
                        </FieldLabel>
                      </Field>
                    );
                  })
                )}
              </FieldGroup>
              <Button type="submit" className="self-start">
                Add subjects
              </Button>
            </form>
          )}
        </Rise>
      </Stagger>
    </PageShell>
  );
}
