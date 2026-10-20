import { describe, expect, it } from "vitest";
import {
  forcedPasswordRedirect,
  readMustChangePassword,
  validateNewPassword,
  FORCED_PASSWORD_PATH,
} from "./password-policy";

describe("password policy", () => {
  it("reads the pref strictly", () => {
    expect(readMustChangePassword({ mustChangePassword: true })).toBe(true);
    expect(readMustChangePassword({ mustChangePassword: "true" })).toBe(false);
    expect(readMustChangePassword({})).toBe(false);
    expect(readMustChangePassword(null)).toBe(false);
  });
  it("redirects only flagged sessions", () => {
    expect(forcedPasswordRedirect({ mustChangePassword: true })).toBe(FORCED_PASSWORD_PATH);
    expect(forcedPasswordRedirect({ mustChangePassword: false })).toBeNull();
  });
  it("validates new passwords", () => {
    expect(validateNewPassword("oldpass12", "short", "short")).toMatch(/at least 8/);
    expect(validateNewPassword("oldpass12", "newpass123", "newpass124")).toMatch(/match/);
    expect(validateNewPassword("samepass1", "samepass1", "samepass1")).toMatch(/different/);
    expect(validateNewPassword("oldpass12", "newpass123", "newpass123")).toBeNull();
  });
});
