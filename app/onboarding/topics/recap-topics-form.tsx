"use client";

import { useFormStatus } from "react-dom";
import { startRecapDiagnosticAction } from "@/app/actions/diagnostic";
import { AiLoading } from "@/components/ai-loading";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

function PendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <AiLoading
      overlay
      title="Building your quiz"
      messages={[
        "Looking at what you picked…",
        "Writing a few questions on each…",
        "Nearly there…",
      ]}
    />
  );
}

export function RecapTopicsForm({
  topicsBySubject,
}: {
  topicsBySubject: {
    subject: { subject_id: string; subject_name: string };
    topics: { id: string; name: string }[];
  }[];
}) {
  return (
    <form
      action={startRecapDiagnosticAction}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
    >
      <PendingOverlay />
      {topicsBySubject.map(
        ({ subject, topics }) =>
          topics.length > 0 && (
            <div key={subject.subject_id} className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {subject.subject_name}
              </p>
              <FieldGroup className="gap-2">
                {topics.map((topic) => {
                  const id = `topic-${topic.id}`;
                  return (
                    <Field key={topic.id} orientation="horizontal" className="rounded-lg border border-border bg-background px-3 py-2 has-[[data-checked]]:border-primary">
                      <Checkbox
                        id={id}
                        name="topic"
                        value={`${subject.subject_id}::${topic.name}`}
                      />
                      <FieldLabel htmlFor={id} className="cursor-pointer text-sm text-foreground">
                        {topic.name}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </FieldGroup>
            </div>
          )
      )}
      <Button type="submit" className="self-start">
        Continue
      </Button>
    </form>
  );
}
