import { describe, expect, it } from "vitest";
import { announcementFor, stripForSpeech } from "./coach-announcement";

describe("stripForSpeech", () => {
  it("removes markdown and math markers", () => {
    expect(stripForSpeech("**Bold** and `code` with $x^2$")).toBe("Bold and code with x^2");
    expect(stripForSpeech("## Title\n- one\n- two")).toBe("Title one two");
    expect(stripForSpeech("[link](http://a.b) \\frac{1}{2}")).toBe("link frac12");
  });
});

describe("announcementFor", () => {
  it("is empty without a turn", () => expect(announcementFor(null)).toBe(""));
  it("returns the reply for text turns", () => {
    expect(announcementFor({ kind: "text", reply: "Hi *there*" } as never)).toBe("Hi there");
  });
  it("includes options for mcq", () => {
    expect(announcementFor({ kind: "mcq", reply: "Pick", options: ["a", "b"], correctIndex: 0, explanation: "" } as never)).toBe("Pick Options: A, a. B, b.");
  });
});
