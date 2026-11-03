import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/progress-bar", () => ({ ProgressBar: () => null }));
vi.mock("@/components/motion", () => ({ Rise: () => null, Stagger: () => null }));
import { topicInSentence } from "./level-shell";

describe("topicInSentence", () => {
  it("drops a 'Topic N:' prefix and lowercases an ordinary first word", () => {
    expect(topicInSentence("Topic 1: Computational thinking")).toBe("computational thinking");
    expect(topicInSentence("Particle model of matter")).toBe("particle model of matter");
  });
  it("keeps acronyms and proper nouns as written", () => {
    expect(topicInSentence("DNA and inheritance")).toBe("DNA and inheritance");
    expect(topicInSentence("ASCII and Unicode")).toBe("ASCII and Unicode");
  });
  it("drops a trailing 'only' qualifier", () => {
    expect(topicInSentence("Space physics (physics only)")).toBe("space physics");
  });
});
