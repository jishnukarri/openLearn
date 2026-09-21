import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects } from "@/lib/supabase/students";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { addSubjectsAction } from "@/app/actions/onboarding";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Add a subject
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pick another subject and exam board to start studying.
        </p>
      </div>

      {available.length === 0 ? (
        <p className="text-sm text-muted">
          You&apos;re already studying everything that&apos;s published, check
          back once more subjects go live.
        </p>
      ) : (
        <form
          action={addSubjectsAction}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
        >
          <FieldGroup className="gap-2">
            {available.map((subject) =>
              subject.exam_boards.map((board) => {
                const id = `subject-${subject.id}-${board.id}`;
                return (
                  <Field key={`${subject.id}:${board.id}`} orientation="horizontal" className="rounded-lg border border-border bg-background px-3 py-2 has-[[data-checked]]:border-primary">
                    <Checkbox
                      id={id}
                      name="subjectExamBoard"
                      value={`${subject.id}:${board.id}`}
                    />
                    <FieldLabel htmlFor={id} className="cursor-pointer text-sm text-foreground">
                      {subject.name}{" "}
                      <span className="text-xs text-muted">({board.name})</span>
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
    </main>
  );
}
