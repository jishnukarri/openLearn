"use client";

import { removeBlocklistEntryAction } from "@/app/actions/blocklist";
import { SubmitButton } from "@/components/submit-button";

export function RemoveBlockButton({ id, label }: { id: string; label: string }) {
  return (
    <form
      action={removeBlocklistEntryAction}
      onSubmit={(e) => {
        if (!window.confirm(`Remove "${label}" from the blocklist? People matching it will be able to sign up again.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="label" value={label} />
      <SubmitButton variant="secondary" size="compact" pendingText="Removing...">
        Remove
      </SubmitButton>
    </form>
  );
}
