import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { hasOnboarded } from "@/lib/supabase/students";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { saveSubjectSelectionAction } from "@/app/actions/onboarding";
import { JoinClassForm } from "./join-class-form";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PageShell, AsideBlock } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

export default async function OnboardingPage() {
  const { session, profile } = await requireRole("student");

  if (await hasOnboarded(profile.id)) {
    redirect("/dashboard");
  }

  const subjects = await listPublishedSubjects();

  return (
    <PageShell
      size="form"
      aside={
        <>
          <AsideBlock title="Join a class (optional)">
            <p>
              Got an invite code from a teacher? Enter it here, you can skip this
              and study on your own instead.
            </p>
            <JoinClassForm />
          </AsideBlock>
          <AsideBlock title="What happens next">
            <ol className="flex list-decimal flex-col gap-1.5 pl-4 marker:text-muted">
              <li>Choose your subjects.</li>
              <li>Take a short diagnostic quiz.</li>
              <li>See where you stand and start your lessons.</li>
            </ol>
          </AsideBlock>
        </>
      }
    >
      <Stagger className="flex flex-col gap-8">
        <Rise>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl lg:leading-[1.1]">
            Welcome, {session.name.split(" ")[0]}
          </h1>
          <p className="mt-3 max-w-[60ch] text-base text-muted">
            Let&apos;s get your subjects set up.
          </p>
        </Rise>

        <Rise>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            Your subjects
          </h2>
          {subjects.length === 0 ? (
            <p className="text-base text-muted">
              No subjects have been published yet, check back soon.
            </p>
          ) : (
            <form action={saveSubjectSelectionAction} className="flex flex-col gap-5">
              <FieldGroup className="gap-2">
                {subjects.map((subject) =>
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

              <Field orientation="horizontal" className="border-t border-border pt-5">
                <Checkbox id="startedSyllabus" name="startedSyllabus" />
                <FieldLabel htmlFor="startedSyllabus" className="cursor-pointer text-base text-foreground">
                  I&apos;ve already started this syllabus at school
                </FieldLabel>
              </Field>

              <Button type="submit" className="self-start">
                Continue
              </Button>
            </form>
          )}
        </Rise>
      </Stagger>
    </PageShell>
  );
}
