"use client";

import { useFormStatus } from "react-dom";
import { AiLoading } from "@/components/ai-loading";

// Drop inside a <form action={...}> whose action is a slow AI-generation
// server action with no other pending UI — reads that form's pending state
// via useFormStatus (only works as a descendant of the form it covers).
export function PendingAiOverlay({
  title,
  messages,
}: {
  title: string;
  messages?: string[];
}) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <AiLoading overlay title={title} messages={messages} />;
}
