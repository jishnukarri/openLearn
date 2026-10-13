"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { renameSubjectAction } from "@/app/actions/subjects";
import { Button } from "@/components/button";
import { SubmitButton } from "@/components/submit-button";

export function RenameSubject({ subjectId, name }: { subjectId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await renameSubjectAction(prev, formData);
      if (!result) setEditing(false);
      return result;
    },
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <Button type="button" variant="secondary" size="compact" onClick={() => setEditing(true)}>
        Rename
      </Button>
    );
  }

  return (
    <form
      action={action}
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false);
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="flex items-center gap-2">
        <label htmlFor="rename-subject" className="sr-only">
          Subject name
        </label>
        <input
          ref={inputRef}
          id="rename-subject"
          name="name"
          defaultValue={name}
          required
          minLength={2}
          autoFocus
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <SubmitButton size="compact" pendingText="Saving...">
          Save
        </SubmitButton>
        <Button type="button" variant="secondary" size="compact" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
