import { describe, expect, it } from "vitest";
import {
  ONBOARDING_PIECES,
  allComplete,
  isMissingTableError,
  completedCount,
  getPiece,
  nextIncompletePiece,
  shouldShowChecklist,
} from "./onboarding-pieces";

const keys = ONBOARDING_PIECES.map((p) => p.key);

describe("onboarding pieces", () => {
  it("has unique keys and valid hrefs", () => {
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of ONBOARDING_PIECES) expect(p.href).toBe(`/onboarding/guide/${p.key}`);
  });

  it("returns the first incomplete piece in order", () => {
    expect(nextIncompletePiece(new Set())?.key).toBe(keys[0]);
    expect(nextIncompletePiece(new Set([keys[0]]))?.key).toBe(keys[1]);
    expect(nextIncompletePiece(new Set([keys[1]]))?.key).toBe(keys[0]);
    expect(nextIncompletePiece(new Set(keys))).toBeNull();
  });

  it("ignores unknown keys when counting", () => {
    expect(completedCount(new Set(["nope", keys[0]]))).toBe(1);
    expect(allComplete(new Set(keys))).toBe(true);
    expect(allComplete(new Set([keys[0]]))).toBe(false);
  });

  it("hides the checklist when done or unavailable", () => {
    expect(shouldShowChecklist(new Set(), true)).toBe(true);
    expect(shouldShowChecklist(new Set(), false)).toBe(false);
    expect(shouldShowChecklist(new Set(keys), true)).toBe(false);
  });

  it("looks pieces up by key", () => {
    expect(getPiece("how-xp-works")?.title).toBeTruthy();
    expect(getPiece("x")).toBeUndefined();
  });
});

describe("isMissingTableError", () => {
  it("recognises missing-table codes and messages", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
    expect(isMissingTableError({ message: 'relation "onboarding_progress" does not exist' })).toBe(true);
  });
  it("ignores other errors", () => {
    expect(isMissingTableError({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});
