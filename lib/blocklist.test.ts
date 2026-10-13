import { describe, it, expect } from "vitest";
import { isBlocked, normalizeEmail, normalizeName, type BlockEntry } from "./blocklist";

const e = (kind: "email" | "name", pattern: string): BlockEntry => ({ kind, pattern });

describe("normalize", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  Jo.Hn+spam@GMail.com ")).toBe("john@gmail.com");
    expect(normalizeEmail("a.b+x@school.org")).toBe("a.b@school.org");
  });
  it("normalizes names", () => {
    expect(normalizeName("  Éric​  O'Neil-Smith ")).toBe("eric o neil smith");
  });
});

describe("email", () => {
  it("matches exact address ignoring tags and gmail dots", () => {
    const list = [e("email", "bad.person@gmail.com")];
    expect(isBlocked("email", "badperson+x@gmail.com", list)).toBe(list[0]);
    expect(isBlocked("email", "other@gmail.com", list)).toBeNull();
  });
  it("matches whole domains", () => {
    for (const p of ["@example.com", "example.com"]) {
      const list = [e("email", p)];
      expect(isBlocked("email", "kid@Example.com", list)).toBe(list[0]);
      expect(isBlocked("email", "kid@mail.example.com", list)).toBe(list[0]);
      expect(isBlocked("email", "kid@notexample.com", list)).toBeNull();
    }
  });
  it("does not match names entries", () => {
    expect(isBlocked("email", "x@example.com", [e("name", "example")])).toBeNull();
  });
});

describe("name", () => {
  const list = [e("name", "bad")];
  it("matches whole words and phrases", () => {
    expect(isBlocked("name", "Mr BAD Guy", list)).toBe(list[0]);
    expect(isBlocked("name", "bad-guy", list)).toBe(list[0]);
    expect(isBlocked("name", "A​nn bád", list)).toBe(list[0]);
  });
  it("does not match inside other words", () => {
    expect(isBlocked("name", "Badger", list)).toBeNull();
    expect(isBlocked("name", "Abad", list)).toBeNull();
  });
  it("catches simple spaced and leet variants", () => {
    expect(isBlocked("name", "b a d", list)).toBe(list[0]);
    expect(isBlocked("name", "b4d", list)).toBe(list[0]);
  });
  it("stays conservative", () => {
    expect(isBlocked("name", "A B", [e("name", "ab")])).toBeNull();
    expect(isBlocked("name", "Room 1234", [e("name", "ioz4")])).toBeNull();
  });
  it("handles phrases", () => {
    const l = [e("name", "spam bot")];
    expect(isBlocked("name", "The Spam   Bot!", l)).toBe(l[0]);
  });
});
