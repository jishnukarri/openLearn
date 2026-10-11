"use client";

import { useActionState } from "react";
import { addExamBoardAction } from "@/app/actions/subjects";
import { SubmitButton } from "@/components/submit-button";

export function AddExamBoardForm() {
  const [state, action] = useActionState(addExamBoardAction, null);

  return (
    <form
      action={action}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="examBoardName" className="text-sm font-medium text-foreground">
            Not seeing an exam board? Add one
          </label>
          <input
            id="examBoardName"
            name="name"
            placeholder="e.g. IB, Cambridge International"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <SubmitButton variant="secondary" size="compact" className="!shadow-none self-start" pendingText="Adding…">
          Add exam board
        </SubmitButton>
      </div>
      {state?.error && (
        <p className="text-sm text-error">{state.error}</p>
      )}
    </form>
  );
}
