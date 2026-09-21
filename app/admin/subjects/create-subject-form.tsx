"use client";

import { useActionState } from "react";
import { createSubjectAction } from "@/app/actions/subjects";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

type ExamBoard = { id: string; name: string };

export function CreateSubjectForm({ examBoards }: { examBoards: ExamBoard[] }) {
  const [state, action] = useActionState(createSubjectAction, null);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Subject name
        </label>
        <input
          id="name"
          name="name"
          placeholder="e.g. Chemistry"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Exam boards</span>
        <div className="flex flex-wrap gap-3">
          {examBoards.map((board) => (
            <Field
              key={board.id}
              orientation="horizontal"
              className="w-auto rounded-lg border border-border bg-background px-3 py-2 has-[[data-checked]]:border-primary"
            >
              <Checkbox id={`board-${board.id}`} name="examBoardIds" value={board.id} />
              <FieldLabel htmlFor={`board-${board.id}`} className="cursor-pointer text-sm text-foreground">
                {board.name}
              </FieldLabel>
            </Field>
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}

      <SubmitButton size="compact" className="self-start" pendingText="Creating…">
        Create subject
      </SubmitButton>
    </form>
  );
}
