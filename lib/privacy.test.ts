import { describe, expect, it } from "vitest";
import { PRIVACY_VERSION, privacyAcknowledged } from "./privacy";

describe("privacyAcknowledged", () => {
  it("needs a stored version at or above the current one", () => {
    expect(privacyAcknowledged(null)).toBe(false);
    expect(privacyAcknowledged(undefined)).toBe(false);
    expect(privacyAcknowledged(PRIVACY_VERSION - 1)).toBe(false);
    expect(privacyAcknowledged(PRIVACY_VERSION)).toBe(true);
    expect(privacyAcknowledged(PRIVACY_VERSION + 1)).toBe(true);
  });
});
