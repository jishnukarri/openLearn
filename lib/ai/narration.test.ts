import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../appwrite/storage", () => ({ uploadFile: vi.fn() }));
vi.mock("./client", () => ({ postChat: vi.fn() }));
import { matchesScript, parseAudioStream, voiceBrief } from "./narration";

const sse = (...events: object[]) => events.map((e) => `data: ${JSON.stringify(e)}`).join("\n\n") + "\n\ndata: [DONE]\n";
const chunk = (audio: object) => ({ choices: [{ delta: { audio } }] });

describe("narration helpers", () => {
  it("reads audio and transcript from a streamed reply", () => {
    const pcm = Buffer.from([1, 2, 3, 4]);
    const { pcm: got, transcript } = parseAudioStream(
      sse(chunk({ data: pcm.toString("base64") }), chunk({ transcript: "Hello " }), chunk({ transcript: "there" }))
    );
    expect(got.equals(pcm)).toBe(true);
    expect(transcript).toBe("Hello there");
  });

  it("returns nothing usable for an error stream", () => {
    expect(parseAudioStream('data: {"error":{"message":"nope"}}\n').pcm.length).toBe(0);
  });

  it("accepts the script and rejects a reply that drifted off it", () => {
    const script = "In a transverse wave each particle moves up and down while the wave travels sideways";
    expect(matchesScript(script, "In a transverse wave, each particle moves up and down, while the wave travels sideways.")).toBe(true);
    expect(matchesScript(script, "Exactly! Great analogy. Anyway, waves are cool.")).toBe(false);
    expect(matchesScript("", "anything")).toBe(false);
  });

  it("briefs the voice as a subject teacher reading the script verbatim", () => {
    const brief = voiceBrief("Physics");
    expect(brief).toMatch(/GCSE Physics teacher/);
    expect(brief).toMatch(/<script>/);
  });
});
