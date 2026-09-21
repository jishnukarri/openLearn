"use client";

import { useState } from "react";
import { deleteAccountAction } from "@/app/actions/account";
import { Button } from "@/components/button";

export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState("");

  return (
    <form action={deleteAccountAction} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        This permanently deletes your account and everything tied to it:
        progress, answers, class memberships. It can&apos;t be undone. Type{" "}
        <span className="font-[family-name:var(--font-mono)] text-foreground">
          DELETE
        </span>{" "}
        to confirm.
      </p>
      <input
        name="confirmation"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder="DELETE"
        className="rounded-lg border border-error/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-error"
      />
      <Button
        type="submit"
        disabled={confirmation !== "DELETE"}
        className="self-start !bg-error !shadow-[0_4px_0_0_#c23f3f]"
      >
        Delete my account
      </Button>
    </form>
  );
}
