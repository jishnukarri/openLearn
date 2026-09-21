"use client";

import { useActionState } from "react";
import { joinClassAction } from "@/app/actions/onboarding";
import { Button } from "@/components/button";

export function JoinClassForm() {
  const [state, action, pending] = useActionState(joinClassAction, undefined);

  return (
    <form action={action} className="flex items-center gap-2">
      <input
        name="inviteCode"
        placeholder="e.g. BYZSM8"
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <Button type="submit" size="compact" disabled={pending}>
        Join
      </Button>
      {state?.message && <span className="text-xs text-muted">{state.message}</span>}
    </form>
  );
}
