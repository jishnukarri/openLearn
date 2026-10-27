import { describe, expect, it } from "vitest";
import { isUuid, safeCursor } from "./ids";

describe("isUuid", () => {
  it("accepts uuids and rejects junk", () => {
    expect(isUuid("3f2b8c1e-9a4d-4b6e-8f10-0a1b2c3d4e5f")).toBe(true);
    expect(isUuid("../etc/passwd")).toBe(false);
    expect(isUuid("1")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("safeCursor", () => {
  it("keeps database timestamps untouched", () => {
    expect(safeCursor("2026-10-27T10:00:00.123456+00:00")).toBe("2026-10-27T10:00:00.123456+00:00");
    expect(safeCursor("2026-10-27T10:00:00Z")).toBe("2026-10-27T10:00:00Z");
  });
  it("drops values Date.parse tolerates but Postgres would reject", () => {
    expect(safeCursor("1")).toBeNull();
    expect(safeCursor("Oct 27 2026")).toBeNull();
    expect(safeCursor("2026-10-27T10:00:00Z);drop")).toBeNull();
    expect(safeCursor("")).toBeNull();
  });
});
