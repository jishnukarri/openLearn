// A voiceover reads the section's own explanation, so the audio, the timings
// and the words on screen all come from one string. Pure and shared by the
// server (which records it) and the player (which displays it).

// Prose the voice can read as it stands: no maths, formulas or LaTeX.
export function isSpeakableProse(text: string): boolean {
  return !/\$|\\\(|\\\[|\\[a-zA-Z]+|[_^]\{?\w/.test(text);
}

// Inline markdown is dropped; whitespace is tidied.
export function speakableText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g, (_m, a, b, c) => a ?? b ?? c ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export const MIN_VOICEOVER_CHARS = 80;
export const MAX_VOICEOVER_CHARS = 1000;
export const MAX_VOICEOVERS_PER_LESSON = 2;

// The script for a section, or null when it should have no voiceover.
export function voiceoverScript(section: { explanation: string; voiceover?: boolean | null }): string | null {
  if (section.voiceover !== true) return null;
  if (!isSpeakableProse(section.explanation)) return null;
  const script = speakableText(section.explanation);
  return script.length >= MIN_VOICEOVER_CHARS && script.length <= MAX_VOICEOVER_CHARS ? script : null;
}

// True when a stored recording still reads exactly what the section says.
export function voiceoverMatches(section: { explanation: string; narration?: string | null; audioId?: string | null }): boolean {
  return !!section.audioId && !!section.narration && section.narration === speakableText(section.explanation);
}
