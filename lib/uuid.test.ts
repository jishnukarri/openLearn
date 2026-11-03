import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts a uuid and rejects everything else", () => {
    expect(isUuid("9a68c4ea-1f00-4be8-a8aa-92e03621bdc8")).toBe(true);
    expect(isUuid("9A68C4EA-1F00-4BE8-A8AA-92E03621BDC8")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("9a68c4ea-1f00-4be8-a8aa-92e03621bdc8'; drop table x;--")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
