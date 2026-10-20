// Combines the teacher's notes for a generation call. The subject note is a
// broad, lower-priority preface; the topic note is more specific and comes
// after it so the model weighs it more heavily. Reference material (RAG)
// is appended last, unchanged.
export function composeInstructions(
  subjectNote: string | null | undefined,
  topicNote: string | null | undefined,
  reference: string | null | undefined
): string | undefined {
  const subject = subjectNote?.trim();
  const topic = topicNote?.trim();
  const parts: string[] = [];
  if (subject) {
    parts.push(`General note for the whole subject (lower priority if it conflicts with the topic note): ${subject}`);
  }
  if (topic) parts.push(topic);
  const notes = parts.join("\n\n");
  const combined = `${notes}${reference ?? ""}`;
  return combined || undefined;
}
