import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { isHttpsRequest } from "@/lib/cookie-options";

// Anonymous visitor identity for the guest-onboarding flow (pick subjects,
// take a diagnostic, see a teaser — no account yet). Just a high-entropy
// bearer token matched by exact equality against diagnostic_sessions.
// guest_token, the same trust model as a session id; no signing needed
// since it carries no claims, only points at a row.
const GUEST_COOKIE = "openlearn_guest";
const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 2; // 2 days — matches the cleanup window

export async function getGuestToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE)?.value ?? null;
}

// Returns the existing guest token if present, otherwise mints and sets a
// new one. Called from the first guest-flow page a visitor lands on.
export async function ensureGuestToken(): Promise<string> {
  const existing = await getGuestToken();
  if (existing) return existing;

  const token = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: await isHttpsRequest(),
    sameSite: "lax",
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return token;
}

// "Start over" — drops the cookie so a fresh token (and fresh DB row) gets
// created on the next guest-flow request. The caller is responsible for
// deleting the old diagnostic_sessions row.
export async function clearGuestToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE);
}
