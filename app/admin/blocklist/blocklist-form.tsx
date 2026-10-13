"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addBlocklistEntryAction, type BlocklistFormState } from "@/app/actions/blocklist";
import { SubmitButton } from "@/components/submit-button";

const INPUT =
  "rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40";

export function BlocklistForm() {
  const [state, action] = useActionState<BlocklistFormState, FormData>(
    addBlocklistEntryAction,
    undefined
  );
  const [kind, setKind] = useState<"email" | "name">("email");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">What do you want to block?</legend>
        <div className="flex flex-wrap gap-5 text-base text-foreground">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="email"
              checked={kind === "email"}
              onChange={() => setKind("email")}
            />
            Email
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="name"
              checked={kind === "name"}
              onChange={() => setKind("name")}
            />
            Name
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pattern" className="text-sm font-medium text-foreground">
          {kind === "email" ? "Email address or domain" : "Word or phrase"}
        </label>
        <input
          id="pattern"
          name="pattern"
          required
          minLength={2}
          maxLength={200}
          autoComplete="off"
          placeholder={kind === "email" ? "@example.com" : "spamword"}
          className={INPUT}
        />
        <p className="text-sm text-muted">
          {kind === "email"
            ? "Block one person: someone@example.com. Block a whole school domain: @example.com"
            : "Block a word in names: spamword. Capital letters and accents don't matter."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-medium text-foreground">
          Note <span className="font-normal text-muted">(optional, only admins see it)</span>
        </label>
        <input id="note" name="note" maxLength={300} className={INPUT} placeholder="Why this is blocked" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Adding...">Add to blocklist</SubmitButton>
        {state?.message && (
          <span role="status" className={`text-sm ${state.ok ? "text-muted" : "text-error"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
