import { describe, expect, it } from "vitest";
import { LESSON_VERSION, isCurrentLesson } from "./lesson-version";

describe("isCurrentLesson", () => {
  it("is true only at or above the current version", () => {
    expect(isCurrentLesson(LESSON_VERSION)).toBe(true);
    expect(isCurrentLesson(LESSON_VERSION + 1)).toBe(true);
    expect(isCurrentLesson(LESSON_VERSION - 1)).toBe(false);
    expect(isCurrentLesson(null)).toBe(false);
    expect(isCurrentLesson(undefined)).toBe(false);
  });
});
