import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/appwrite/session";

// Optimistic check only: presence of the cookie, not a verified session.
// Real verification happens close to the data via requireSession() in the
// DAL (lib/appwrite/session.ts) — proxy just avoids an obviously wasted
// render for logged-out users hitting a protected route, and keeps logged-in
// users off the auth forms.
const protectedRoutes = [
  "/onboarding",
  "/admin",
  "/teacher",
  "/dashboard",
  "/learn",
  "/practice",
  "/join",
  "/account",
  "/privacy/accept",
];
const authRoutes = ["/login", "/signup"];

// The phone hand-off upload page is a temporary link that needs no login.
const publicUploadPath = /^\/practice\/[^/]+\/upload\/[^/]+\/?$/;

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (publicUploadPath.test(pathname)) return NextResponse.next();

  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (authRoutes.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|ico|svg)$).*)"],
};
