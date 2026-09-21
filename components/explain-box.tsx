"use client";

import { useState } from "react";
import { RichText } from "@/components/rich-text";

// "Why is this the answer?", fetched only when tapped. AI explanations can
// genuinely take 10-15s, so this shows an actual loading state (spinner +
// skeleton lines) instead of just a button label change, which read as
// broken/frozen when the wait ran long.
export function ExplainBox({ fetchExplanation }: { fetchExplanation: () => Promise<string> }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-background p-3 text-xs text-muted">
        <span
          aria-hidden
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted border-t-primary"
        />
        Thinking this through…
      </div>
    );
  }

  if (explanation !== null) {
    return (
      <p className="rounded-lg bg-background p-3 text-xs text-muted">
        <RichText text={explanation} />
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        try {
          setExplanation(await fetchExplanation());
        } catch {
          setExplanation("Couldn't load an explanation, try again in a moment.");
        } finally {
          setLoading(false);
        }
      }}
      className="self-start text-xs font-medium text-primary hover:underline"
    >
      Why is this the answer?
    </button>
  );
}
