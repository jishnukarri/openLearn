import { describe, expect, it } from "vitest";
import { stripNul } from "./strip-nul";

describe("stripNul", () => {
  it("removes NUL characters from nested payloads", () => {
    expect(stripNul({ a: "x\u0000y", b: ["p\u0000", { c: "q\u0000r" }], n: 3, d: null })).toEqual({
      a: "xy",
      b: ["p", { c: "qr" }],
      n: 3,
      d: null,
    });
  });
});
