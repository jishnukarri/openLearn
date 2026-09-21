"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  prependOrigin = false,
}: {
  text: string;
  label?: string;
  prependOrigin?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const value = prependOrigin ? `${window.location.origin}${text}` : text;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-foreground"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
