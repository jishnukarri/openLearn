import { describe, expect, it } from "vitest";
import { activeWord, splitWords, wordStartTimes } from "./audio-timing";

const RATE = 24_000;

// Speech-like bursts (one per sentence, length proportional to its words) with silent gaps.
function render(parts: { seconds: number; silent?: boolean }[]): Int16Array {
  const total = parts.reduce((a, p) => a + p.seconds, 0);
  const out = new Int16Array(Math.round(total * RATE));
  let at = 0;
  for (const p of parts) {
    const n = Math.round(p.seconds * RATE);
    if (!p.silent) for (let i = 0; i < n; i++) out[at + i] = Math.round(Math.sin((2 * Math.PI * 200 * i) / RATE) * 9000);
    at += n;
  }
  return out;
}

describe("word timings", () => {
  const script = "Waves carry energy. Particles only move up and down. The wave itself travels sideways.";

  it("lines sentences up with the pauses in the audio", () => {
    // sentence 1: 0.0-1.0s, pause, sentence 2: 1.6-3.4s, pause, sentence 3: 4.0-5.6s
    const samples = render([{ seconds: 1.0 }, { seconds: 0.6, silent: true }, { seconds: 1.8 }, { seconds: 0.6, silent: true }, { seconds: 1.6 }]);
    const t = wordStartTimes(script, samples, RATE);
    const words = splitWords(script);
    expect(t).toHaveLength(words.length);
    expect(t[0]).toBeLessThan(80);
    // "Particles" opens sentence 2, "The" opens sentence 3
    expect(Math.abs(t[words.indexOf("Particles")] - 1600)).toBeLessThan(80);
    expect(Math.abs(t[words.indexOf("The")] - 4000)).toBeLessThan(80);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });

  it("pins a word to a pause inside a sentence", () => {
    const text = "Particles only move up and down while the wave travels sideways.";
    // a 0.4 s breath from 2.0 s to 2.4 s: some word must start right as it ends,
    // and none may start inside it
    const samples = render([{ seconds: 2.0 }, { seconds: 0.4, silent: true }, { seconds: 2.0 }]);
    const t = wordStartTimes(text, samples, RATE);
    expect(t.some((x) => Math.abs(x - 2400) < 80)).toBe(true);
    expect(t.some((x) => x > 2080 && x < 2320)).toBe(false);
  });

  it("falls back to an even spread when the audio has no pauses", () => {
    const samples = render([{ seconds: 6 }]);
    const t = wordStartTimes(script, samples, RATE);
    expect(t).toHaveLength(splitWords(script).length);
    expect(t[t.length - 1]).toBeLessThan(6000);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });

  it("handles empty text and silent audio", () => {
    expect(wordStartTimes("", render([{ seconds: 1 }]), RATE)).toEqual([]);
    expect(wordStartTimes("Just one", new Int16Array(RATE), RATE)).toHaveLength(2);
  });

  it("finds the word being spoken", () => {
    const starts = [0, 400, 900, 1500];
    expect(activeWord(starts, -5)).toBe(-1);
    expect(activeWord(starts, 0)).toBe(0);
    expect(activeWord(starts, 899)).toBe(1);
    expect(activeWord(starts, 99999)).toBe(3);
  });
});
