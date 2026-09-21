"use client";

import { useActionState } from "react";
import { updateNameAction, type AccountFormState } from "@/app/actions/account";
import { Button } from "@/components/button";

export function UpdateNameForm({ currentName }: { currentName: string }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updateNameAction,
    undefined
  );

  return (
    <form action={action} className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={currentName}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      <Button type="submit" size="compact" disabled={pending}>
        Save
      </Button>
      {state?.message && (
        <span className="text-xs text-muted">{state.message}</span>
      )}
    </form>
  );
}
