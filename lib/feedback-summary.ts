// Short, one-line reason for a check verdict: whole sentences up to `max`
// characters, never cut mid-sentence unless the first sentence alone is too
// long (then cut at a word and add an ellipsis).
const TEX_SYMBOLS: Record<string, string> = {
  times: "×", cdot: "·", div: "÷", pm: "±", leq: "≤", le: "≤", geq: "≥", ge: "≥",
  neq: "≠", ne: "≠", approx: "≈", pi: "π", theta: "θ", Delta: "Δ", infty: "∞", degree: "°",
};

// The reason line is plain text, so inline/display math ($x^2$, $$...$$)
// is flattened to readable text instead of leaking raw $ and \commands.
export function flattenMath(text: string): string {
  const tex = (m: string) =>
    m
      .replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√$1")
      .replace(/\\([A-Za-z]+)/g, (_, c: string) => TEX_SYMBOLS[c] ?? "")
      .replace(/\\[,;! ]/g, " ")
      .replace(/[{}]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => tex(m))
    .replace(/\$([^$\n]+?)\$/g, (_, m: string) => tex(m));
}

export function shortReason(text: string, max = 140): string {
  const clean = flattenMath(text)
    .replace(/\*+|`+/g, "")
    .replace(/(^|[^\w])_+|_+(?=[^\w]|$)/g, "$1") // emphasis underscores, not snake_case / x_1
    .replace(/\s+/g, " ")
    .trim();
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
