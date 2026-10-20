// Short, one-line reason for a check verdict: whole sentences up to `max`
// characters, never cut mid-sentence unless the first sentence alone is too
// long (then cut at a word and add an ellipsis).
export function shortReason(text: string, max = 140): string {
  const clean = text.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = "";
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}
