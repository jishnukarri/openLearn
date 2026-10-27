import type { CoachTurn } from "@/lib/ai/lesson-tutor";

// Plain text for a screen-reader live region: markdown and KaTeX markers removed.
export function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
    .replace(/\$([^$\n]+)\$/g, " $1 ")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, " ")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_`~>]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function announcementFor(turn: CoachTurn | null): string {
  if (!turn) return "";
  const reply = stripForSpeech(turn.reply);
  if (turn.kind !== "mcq") return reply;
  const options = turn.options.map((o, i) => `${String.fromCharCode(65 + i)}, ${stripForSpeech(o)}`).join(". ");
  return `${reply} Options: ${options}.`;
}
