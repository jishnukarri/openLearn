// Pure helpers behind the stepped worked-example player. No AI calls: a
// stored lesson without authored steps gets them derived from its text.

const MAX_STEPS = 6;

// Splits on newlines first, otherwise on sentence ends. Maths in $...$ is
// masked so a decimal point or full stop inside a formula never splits it.
export function deriveExampleSteps(example: string, max = MAX_STEPS): string[] {
  const text = (example ?? "").trim();
  if (!text) return [];
  const masked: string[] = [];
  const hidden = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, (m) => {
    masked.push(m);
    return `\u0000${masked.length - 1}\u0000`;
  });
  const restore = (s: string) =>
    s.replace(/\u0000(\d+)\u0000/g, (_, i) => masked[Number(i)] ?? "").trim();

  let parts = hidden.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = hidden
      .split(/(?<=[.!?])\s+(?=[A-Z0-9\u0000(])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  let steps = parts.map(restore).map((s) => s.replace(/^(?:step\s*)?\d+[.):]\s*/i, "")).filter(Boolean);
  // Too many: fold the tail into the last step so nothing is lost.
  if (steps.length > max) {
    steps = [...steps.slice(0, max - 1), steps.slice(max - 1).join(" ")];
  }
  return steps.length ? steps : [text];
}

export function resolveExampleSteps(section: {
  example: string;
  exampleSteps?: string[] | null;
}): string[] {
  const authored = (section.exampleSteps ?? [])
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  return authored.length ? authored : deriveExampleSteps(section.example);
}

// How many steps are shown at a given index; reduced motion shows all.
export function visibleCount(index: number, total: number, showAll: boolean): number {
  if (showAll) return total;
  return Math.max(0, Math.min(total, index + 1));
}
