import { describe, expect, it } from "vitest";
import { isSpeakableProse, speakableText, voiceoverMatches, voiceoverScript } from "./tts-text";

const prose = "A transverse wave shakes particles up and down while the wave itself moves sideways. Think of a stadium wave where nobody leaves their seat.";

describe("voiceover text", () => {
  it("strips inline markdown", () => {
    expect(speakableText("A **wave** moves *energy*  and `v`.")).toBe("A wave moves energy and v.");
  });

  it("rejects maths and formulas", () => {
    expect(isSpeakableProse("Speed is $v = f\\lambda$.")).toBe(false);
    expect(isSpeakableProse("Water is H_2O")).toBe(false);
    expect(isSpeakableProse(prose)).toBe(true);
  });

  it("only scripts flagged prose sections of a sensible length", () => {
    expect(voiceoverScript({ explanation: prose, voiceover: true })).toBe(prose);
    expect(voiceoverScript({ explanation: prose })).toBeNull();
    expect(voiceoverScript({ explanation: prose, voiceover: false })).toBeNull();
    expect(voiceoverScript({ explanation: "Too short.", voiceover: true })).toBeNull();
    expect(voiceoverScript({ explanation: "x ".repeat(800), voiceover: true })).toBeNull();
  });

  it("knows when a recording no longer matches the text", () => {
    expect(voiceoverMatches({ explanation: prose, narration: prose, audioId: "a" })).toBe(true);
    expect(voiceoverMatches({ explanation: prose + " More.", narration: prose, audioId: "a" })).toBe(false);
    expect(voiceoverMatches({ explanation: prose, narration: prose })).toBe(false);
  });
});
