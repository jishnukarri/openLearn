import { describe, it, expect } from "vitest";
import { withInFlight, InFlightError, isInFlight } from "./in-flight";

describe("withInFlight", () => {
  it("rejects a second concurrent call for the same key", async () => {
    let release!: () => void;
    const first = withInFlight("k1", () => new Promise<void>((r) => (release = r)));
    await expect(withInFlight("k1", async () => 1)).rejects.toBeInstanceOf(InFlightError);
    release();
    await first;
    expect(isInFlight("k1")).toBe(false);
  });
  it("allows different keys in parallel", async () => {
    await expect(Promise.all([withInFlight("a", async () => 1), withInFlight("b", async () => 2)])).resolves.toEqual([1, 2]);
  });
  it("releases the key when the work throws", async () => {
    await expect(withInFlight("k2", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(withInFlight("k2", async () => "ok")).resolves.toBe("ok");
  });
  it("lets a stale claim expire", async () => {
    let t = 0;
    const now = () => t;
    let release!: () => void;
    const hung = withInFlight("k3", () => new Promise<void>((r) => (release = r)), 1000, now);
    t = 2000;
    await expect(withInFlight("k3", async () => "fresh", 1000, now)).resolves.toBe("fresh");
    release();
    await hung;
  });
});
