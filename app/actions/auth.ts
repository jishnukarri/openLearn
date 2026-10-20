"use server";

import * as z from "zod";
import { ID } from "node-appwrite";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createServerUsers,
  createPublicAccount,
  createSessionClient,
} from "@/lib/appwrite/server";
import { SESSION_COOKIE } from "@/lib/appwrite/session";
import { createProfile, getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { PasswordSchema, readMustChangePassword, FORCED_PASSWORD_PATH } from "@/lib/password-policy";
import { roleHome } from "@/lib/roles";
import { isHttpsRequest } from "@/lib/cookie-options";
import { checkRateLimit, checkKeyRateLimit } from "@/lib/rate-limit";
import { getGuestToken, clearGuestToken } from "@/lib/guest-session";
import { getBlockMatch } from "@/lib/supabase/blocklist";
import { getActiveGuestSession } from "@/lib/supabase/diagnostic";
import { convertGuestSessionToStudent } from "@/lib/guest-diagnostic";

export type AuthFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long.").trim(),
  email: z.email("Please enter a valid email.").trim(),
  password: PasswordSchema,
});

const LoginSchema = z.object({
  email: z.email("Please enter a valid email.").trim(),
  password: z.string().min(1, "Password is required."),
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function setSessionCookie(secret: string, expire: string) {
  const cookieStore = await cookies();
  // An unparsable or already-past expiry would make the browser treat this
  // as a session cookie or drop it, so fall back to 30 days.
  const parsed = new Date(expire);
  const expires =
    Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now()
      ? parsed
      : new Date(Date.now() + THIRTY_DAYS_MS);
  cookieStore.set(SESSION_COOKIE, secret, {
    httpOnly: true,
    secure: await isHttpsRequest(),
    sameSite: "lax",
    path: "/",
    expires,
    maxAge: Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1000)),
  });
}

export async function signup(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  if (!(await checkRateLimit("signup", 5, 60_000))) {
    return { message: "Too many attempts. Please try again in a minute." };
  }

  const { name, email, password } = validated.data;

  if ((await getBlockMatch("email", email)) || (await getBlockMatch("name", name))) {
    return {
      message:
        "This email or name can't be used. Contact your administrator if you think this is a mistake.",
    };
  }

  const isTeacher = formData.get("isTeacher") === "1";
  let profileId: string;

  try {
    const users = createServerUsers();
    const user = await users.create(ID.unique(), email, undefined, password, name);

    // Account.createEmailPasswordSession (public client, no API key) returns
    // secret: "" by design — Appwrite only populates it for browser clients.
    // Users.createSession (API key, admin-privileged) is the server-side way
    // to mint a session with a real, usable secret.
    const session = await users.createSession({ userId: user.$id });
    await setSessionCookie(session.secret, session.expire);

    const profile = await createProfile({
      appwriteUserId: user.$id,
      email,
      fullName: name,
      role: isTeacher ? "pending_teacher" : "student",
    });
    profileId = profile.id;
  } catch {
    // Generic message for all failures, including "email already exists"
    // (Appwrite 409) — a distinct message here would let an attacker
    // enumerate registered emails.
    return { message: "Something went wrong creating your account." };
  }

  // A student who did the guest diagnostic before signing up gets it
  // attached as their real onboarding diagnostic instead of starting over —
  // their effort isn't thrown away just because they created an account
  // after, not before, doing the work. Outside the try/catch: redirect()
  // works by throwing, which the catch above would otherwise swallow into
  // a false "something went wrong" after the account was actually created.
  if (!isTeacher) {
    const guestToken = await getGuestToken();
    if (guestToken) {
      const guestSession = await getActiveGuestSession(guestToken);
      if (guestSession) {
        await convertGuestSessionToStudent(guestSession.id, profileId);
        await clearGuestToken();
        redirect(`/onboarding/diagnostic/${guestSession.id}/results`);
      }
    }
  }

  redirect(isTeacher ? "/pending-approval" : "/onboarding");
}

export async function login(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  if (!(await checkRateLimit("login", 5, 60_000))) {
    return { message: "Too many attempts. Please try again in a minute." };
  }
  if (!await checkKeyRateLimit("login-email", String(formData.get("email") ?? ""), 10, 10 * 60_000)) {
    return { message: "Too many attempts. Please try again in a few minutes." };
  }

  const { email, password } = validated.data;

  let userId: string;
  let mustChange = false;
  try {
    // Verifies the password (throws on mismatch). Its secret is unusable —
    // see the comment in signup() — so we only use it to confirm the
    // credentials and learn the userId, then mint a real session below.
    const account = createPublicAccount();
    const verifiedSession = await account.createEmailPasswordSession(
      email,
      password
    );
    userId = verifiedSession.userId;

    const users = createServerUsers();
    const session = await users.createSession({ userId });
    await setSessionCookie(session.secret, session.expire);
  } catch (e) {
    // Appwrite only reports a blocked account after the password checked out,
    // so saying so doesn't reveal which emails exist.
    const err = e as { type?: string; message?: string };
    if (err?.type === "user_blocked" || /\bblocked\b/i.test(err?.message ?? "")) {
      return { message: "This account has been blocked. Please contact your administrator." };
    }
    return { message: "Incorrect email or password." };
  }

  try {
    mustChange = readMustChangePassword(await createServerUsers().getPrefs(userId));
  } catch {
    // Guards re-check the flag on the next request anyway.
  }
  if (mustChange) redirect(FORCED_PASSWORD_PATH);

  const profile = await getProfileByAppwriteId(userId);

  // Mirrors the guest-conversion branch in signup() — a returning visitor
  // who logs into an existing account from the guest results teaser (rather
  // than creating a new one) still deserves their effort carried over
  // instead of landing on their dashboard with the guest diagnostic
  // orphaned under a cookie nobody converts.
  if (profile?.role === "student") {
    const guestToken = await getGuestToken();
    if (guestToken) {
      const guestSession = await getActiveGuestSession(guestToken);
      if (guestSession) {
        await convertGuestSessionToStudent(guestSession.id, profile.id);
        await clearGuestToken();
        redirect(`/onboarding/diagnostic/${guestSession.id}/results`);
      }
    }
  }

  redirect(roleHome(profile?.role));
}

export async function logout() {
  const cookieStore = await cookies();
  const secret = cookieStore.get(SESSION_COOKIE)?.value;

  if (secret) {
    try {
      await createSessionClient(secret).deleteSession("current");
    } catch {
      // session already invalid server-side; still clear the cookie below
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
