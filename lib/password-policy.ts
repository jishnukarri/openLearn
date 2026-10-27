import * as z from "zod";

// Appwrite user pref set by an admin password reset; cleared once the user
// chooses their own password.
export const MUST_CHANGE_PASSWORD_PREF = "mustChangePassword";
export const FORCED_PASSWORD_PATH = "/account/password?required=1";

// Shared by signup and the change-password form.
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(256, "Password must be at most 256 characters long.");

export function readMustChangePassword(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object") return false;
  return (prefs as Record<string, unknown>)[MUST_CHANGE_PASSWORD_PREF] === true;
}

// Where a flagged session must go, or null when no redirect is needed.
export function forcedPasswordRedirect(session: { mustChangePassword: boolean }): string | null {
  return session.mustChangePassword ? FORCED_PASSWORD_PATH : null;
}

// Returns an error message, or null when acceptable.
export function validateNewPassword(current: string, next: string, confirm: string): string | null {
  const parsed = PasswordSchema.safeParse(next);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid password.";
  if (next !== confirm) return "The two new passwords don't match.";
  if (next === current) return "Choose a password that's different from your current one.";
  return null;
}
