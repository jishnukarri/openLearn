import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { hasOnboarded } from "@/lib/supabase/students";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { saveSubjectSelectionAction } from "@/app/actions/onboarding";
import { JoinClassForm } from "./join-class-form";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export default async function OnboardingPage() {
  const { session, profile } = await requireRole("student");

  if (await hasOnboarded(profile.id)) {
    redirect("/dashboard");
  }

  const subjects = await listPublishedSubjects();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-10 px-6 py-16">
      <div className="animate-fade-slide-up">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Welcome, {session.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Let&apos;s get your subjects set up.
        </p>
      </div>

      <section
        style={{ animationDelay: "80ms" }}
        className="animate-fade-slide-up flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 className="text-sm font-semibold text-foreground">
          Join a class (optional)
        </h2>
        <p className="text-xs text-muted">
          Got an invite code from a teacher? Enter it here, you can skip this
          and study on your own instead.
        </p>
        <JoinClassForm />
      </section>

      <section
        style={{ animationDelay: "160ms" }}
        className="animate-fade-slide-up flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 className="text-sm font-semibold text-foreground">Your subjects</h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted">
            No subjects have been published yet, check back soon.
          </p>
        ) : (
          <form action={saveSubjectSelectionAction} className="flex flex-col gap-4">
            <FieldGroup className="gap-2">
              {subjects.map((subject) =>
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

            <Field orientation="horizontal" className="py-1">
              <Checkbox id="startedSyllabus" name="startedSyllabus" />
              <FieldLabel htmlFor="startedSyllabus" className="cursor-pointer text-sm text-foreground">
                I&apos;ve already started this syllabus at school
              </FieldLabel>
            </Field>

            <Button type="submit" className="self-start">
              Continue
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
