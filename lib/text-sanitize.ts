// Guards against garbled AI output — occasionally a generation run repeats
// an emoji/variation-selector thousands of times in a row (a known failure
// mode of some providers under load) instead of emitting normal text.
// Collapses any run of 4+ identical characters down to one, which fixes
// the runaway-repeat case without touching normal text (nothing legitimate
// repeats a single character 4+ times in a row).
export function collapseRepeatedChars(text: string): string {
  return text.replace(/(.)\1{3,}/gu, "$1");
}

// Recursively applies collapseRepeatedChars to every string in an
// AI-generated JSON structure (lesson content, interactives, etc) — a
// single pass that survives shape drift, so a new field/variant never
// needs a matching update here.
export function deepCollapseRepeatedChars<T>(value: T): T {
  if (typeof value === "string") return collapseRepeatedChars(value) as unknown as T;
  if (Array.isArray(value)) return value.map(deepCollapseRepeatedChars) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepCollapseRepeatedChars(v)])
    ) as T;
  }
  return value;
}


// Older stored lessons narrate the activity ("The interactive demonstrates
// that ..."). Drop that framing so the sentence states the idea itself.
export function stripActivityFraming(text: string): string {
  const t = text
    .trim()
    .replace(
      /^(?:the |this )?(?:interactive|simulation|demonstration|activity|animation|exercise)\s+(?:demonstrates|shows|illustrates|reveals|highlights)\s+(?:that\s+)?/i,
      ""
    );
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// One short sentence for the "what this means" panel.
export function shortTakeaway(text: string): string {
  const t = stripActivityFraming(text);
  const first = t.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? t;
  return first.length > 30 ? first : t;
}
