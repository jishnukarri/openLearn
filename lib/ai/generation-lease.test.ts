import { describe, expect, it, vi } from "vitest";
import { leaseKey, withGenerationLease } from "./generation-lease";

const sleep = vi.fn(async () => {});

describe("withGenerationLease", () => {
  it("winner generates and never polls", async () => {
    const generate = vi.fn().mockResolvedValue(["a"]);
    const readCached = vi.fn();
    const r = await withGenerationLease({ acquire: async () => true, generate, readCached, sleep });
    expect(r).toEqual(["a"]);
    expect(readCached).not.toHaveBeenCalled();
  });
  it("loser polls until the cache fills", async () => {
    const generate = vi.fn();
    const readCached = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(["x"]);
    const r = await withGenerationLease({ acquire: async () => false, generate, readCached, sleep });
    expect(r).toEqual(["x"]);
    expect(generate).not.toHaveBeenCalled();
    expect(readCached).toHaveBeenCalledTimes(3);
  });
  it("loser gives up after the max wait", async () => {
    const readCached = vi.fn().mockResolvedValue(null);
    const r = await withGenerationLease({
      acquire: async () => false, generate: vi.fn(), readCached, sleep, pollMs: 1500, maxWaitMs: 25000,
    });
    expect(r).toBeNull();
    expect(readCached).toHaveBeenCalledTimes(17);
  });
  it("builds keys", () => expect(leaseKey("q", "hints")).toBe("q:hints"));
});
