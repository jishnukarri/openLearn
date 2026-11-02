import { describe, expect, it } from "vitest";
import { normalizePcm, pcm16ToMp3 } from "./audio-encode";

function sine(seconds: number, amplitude: number, rate = 24_000): Buffer {
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * amplitude), i * 2);
  return buf;
}

describe("audio encoding", () => {
  it("raises quiet speech without clipping", () => {
    const quiet = new Int16Array(sine(1, 2000).buffer.slice(0));
    const loud = normalizePcm(quiet);
    const peak = (a: Int16Array) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(peak(loud)).toBeGreaterThan(peak(quiet) * 2);
    expect(peak(loud)).toBeLessThan(32767);
  });

  it("produces an MP3 of the right length", () => {
    const mp3 = pcm16ToMp3(sine(2, 8000));
    // MPEG frame sync: 11 set bits.
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    // 64 kbps for 2 s is about 16 KB.
    expect(mp3.length).toBeGreaterThan(12_000);
    expect(mp3.length).toBeLessThan(20_000);
  });
});
